const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Op, Sequelize } = require('sequelize');
const { authMiddleware } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');
const { aggregateTracks, addInto, emptyTotals } = require('../utils/statsAggregator');
const { coverUrlFor } = require('../utils/coverUrl');
const { Series, SeriesAdventure, Adventure, GpxTrack, Picture, Waypoint, User, Tag } = require('../models');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const series = await Series.findAll({
      where: { user_id: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    if (series.length === 0) {
      return res.json({ series: [], total: 0 });
    }
    const seriesIds = series.map(s => s.id);

    const [allJoins, allAdventureRows, trackSums, pictureCounts] = await Promise.all([
      SeriesAdventure.findAll({
        where: { SeriesId: { [Op.in]: seriesIds } },
        attributes: ['SeriesId', 'AdventureId', 'order'],
        order: [['order', 'ASC']]
      }),
      Adventure.findAll({ attributes: ['id', 'adventure_date'] }),
      GpxTrack.findAll({
        where: {},
        attributes: ['adventure_id',
          [Sequelize.fn('SUM', Sequelize.col('distance')), 'total'],
          [Sequelize.fn('SUM', Sequelize.col('duration_s')), 'totalDuration']],
        group: ['adventure_id']
      }),
      Picture.findAll({
        attributes: ['adventure_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
        group: ['adventure_id']
      })
    ]);

    const joinsBySeries = {};
    allJoins.forEach(j => {
      (joinsBySeries[j.SeriesId] = joinsBySeries[j.SeriesId] || []).push(j);
    });
    const dateById = new Map(allAdventureRows.map(a => [a.id, a.adventure_date]));
    const distById = new Map(trackSums.map(t => [t.adventure_id, parseFloat(t.get('total')) || 0]));
    const durById = new Map(trackSums.map(t => [t.adventure_id, parseInt(t.get('totalDuration')) || 0]));
    const photoCountById = new Map(pictureCounts.map(p => [p.adventure_id, parseInt(p.get('count')) || 0]));

    const seriesWithStats = series.map(s => {
      const rows = joinsBySeries[s.id] || [];
      const adventureIds = rows.map(r => r.AdventureId);
      const adventuresWithOrder = rows
        .filter(r => dateById.has(r.AdventureId))
        .map(r => ({ id: r.AdventureId, adventure_date: dateById.get(r.AdventureId), order: r.order }));

      let startDate = null;
      let endDate = null;
      adventuresWithOrder.forEach(adv => {
        if (adv.adventure_date) {
          if (!startDate || new Date(adv.adventure_date) < new Date(startDate)) startDate = adv.adventure_date;
          if (!endDate || new Date(adv.adventure_date) > new Date(endDate)) endDate = adv.adventure_date;
        }
      });

      const totalDistance = adventureIds.reduce((acc, id) => acc + (distById.get(id) || 0), 0);
      const totalHours = Math.round((adventureIds.reduce((acc, id) => acc + (durById.get(id) || 0), 0) / 3600) * 10) / 10;
      const totalPhotos = adventureIds.reduce((acc, id) => acc + (photoCountById.get(id) || 0), 0);

      return {
        id: s.id,
        name: s.name,
        description: s.description,
        start_date: s.start_date || startDate,
        end_date: s.end_date || endDate,
        adventureCount: adventuresWithOrder.length,
        adventureIds,
        totalPhotos,
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalHours,
        isOwner: s.user_id === req.user.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };
    });

    res.json({ series: seriesWithStats, total: seriesWithStats.length });
  } catch (error) {
    return handleError(error, res, { operation: 'listSeries' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const series = await Series.findOne({
      where: { id },
      include: [{ model: User, as: 'owner', attributes: ['id', 'username'] }]
    });

    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const hasAccess = series.user_id === req.user.id;
    if (!hasAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const seriesAdventures = await SeriesAdventure.findAll({
      where: { SeriesId: id },
      order: [['order', 'ASC']]
    });

    const adventureIds = seriesAdventures.map(sa => sa.AdventureId);
    const adventures = await Adventure.findAll({
      where: { id: { [Op.in]: adventureIds } },
        include: [
          { model: GpxTrack, as: 'GpxTracks' },
          {
            model: Picture,
            as: 'Pictures',
            attributes: ['id', 'adventure_id', 'immich_asset_id', 'filename', 'taken_at', 'latitude', 'longitude',
              [Sequelize.literal('"Pictures"."thumbnail_url" IS NOT NULL'), 'has_thumb']]
          },
          { model: Waypoint, as: 'Waypoints' },
          { model: Tag, as: 'tags', attributes: ['id', 'name', 'color', 'type'], through: { attributes: [] } }
        ]
    });

    const adventuresWithDetails = seriesAdventures.map(sa => {
      const adv = adventures.find(a => a.id === sa.AdventureId);
      if (!adv) return null;
      
      const advJson = adv.toJSON();
      let distance = 0;
      advJson.GpxTracks?.forEach(t => {
        distance += t.distance || 0;
      });

      if (advJson.Pictures) {
        advJson.Pictures = advJson.Pictures.map(p => ({
          id: p.id,
          filename: p.filename,
          taken_at: p.taken_at,
          latitude: p.latitude,
          longitude: p.longitude,
          thumbnail_url: coverUrlFor(p)
        }));
      }
      
      return {
        ...advJson,
        order: sa.order,
        distance,
        pictureCount: advJson.Pictures?.length || 0,
        waypointCount: advJson.Waypoints?.length || 0,
        tags: (advJson.tags || []).map(t => ({ id: t.id, name: t.name, color: t.color, category: t.type || 'Custom' }))
      };
    }).filter(Boolean);

    let totalDistance = 0;
    let totalPhotos = 0;
    let totalWaypoints = 0;
    let totalDuration = 0;
    const allTracks = [];
    let minLat = null, maxLat = null, minLng = null, maxLng = null;

    for (const adv of adventuresWithDetails) {
      totalDistance += adv.distance || 0;
      totalPhotos += adv.pictureCount || 0;
      totalWaypoints += adv.waypointCount || 0;

      adv.GpxTracks?.forEach(t => {
        totalDuration += t.duration_s || 0;
        if (t.data && t.data.length > 0) {
          allTracks.push(t);
          t.data.forEach(p => {
            if (p.lat && p.lng) {
              if (minLat === null || p.lat < minLat) minLat = p.lat;
              if (maxLat === null || p.lat > maxLat) maxLat = p.lat;
              if (minLng === null || p.lng < minLng) minLng = p.lng;
              if (maxLng === null || p.lng > maxLng) maxLng = p.lng;
            }
          });
        }
      });
    }

    let center_lat = null;
    let center_lng = null;
    if (minLat !== null && maxLat !== null) {
      center_lat = (minLat + maxLat) / 2;
      center_lng = (minLng + maxLng) / 2;
    }

    res.json({
      series: {
        id: series.id,
        name: series.name,
        description: series.description,
        start_date: series.start_date,
        end_date: series.end_date,
        isOwner: series.user_id === req.user.id,
        createdAt: series.createdAt,
        updatedAt: series.updatedAt,
        adventures: adventuresWithDetails,
        stats: {
        totalDistance: Math.round(totalDistance * 100) / 100,
        totalHours: Math.round((totalDuration / 3600) * 10) / 10,
          totalPhotos,
          totalWaypoints,
          adventureCount: adventuresWithDetails.length
        },
        center_lat,
        center_lng
      }
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getSeries' });
  }
});

router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    const series = await Series.findByPk(id, { attributes: ['id', 'user_id'] });
    if (!series) {
      return res.status(404).json({ error: 'Series not found' });
    }
    if (series.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const joins = await SeriesAdventure.findAll({
      where: { SeriesId: id },
      attributes: ['AdventureId'],
      order: [['order', 'ASC']]
    });
    const adventureIds = joins.map(j => j.AdventureId);
    if (adventureIds.length === 0) {
      return res.json({ totals: { distanceKm: 0, gainM: 0, hours: 0 }, byAdventure: [], byType: [] });
    }

    const [adventures, tracks, photoCounts, waypointCounts] = await Promise.all([
      Adventure.findAll({
        where: { id: { [Op.in]: adventureIds } },
        attributes: ['id', 'name', 'adventure_date']
      }),
      GpxTrack.findAll({
        where: { adventure_id: { [Op.in]: adventureIds } },
        attributes: ['adventure_id', 'type', 'distance', 'data']
      }),
      Picture.findAll({
        where: { adventure_id: { [Op.in]: adventureIds } },
        attributes: ['adventure_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
        group: ['adventure_id']
      }),
      Waypoint.findAll({
        where: { adventure_id: { [Op.in]: adventureIds } },
        attributes: ['adventure_id', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
        group: ['adventure_id']
      })
    ]);

    const photosById = new Map(photoCounts.map(p => [p.adventure_id, parseInt(p.get('count')) || 0]));
    const waypointsById = new Map(waypointCounts.map(w => [w.adventure_id, parseInt(w.get('count')) || 0]));
    const advById = new Map(adventures.map(a => [a.id, a]));

    const totals = emptyTotals();
    const typeMap = new Map();
    const byAdventure = adventureIds
      .filter(advId => advById.has(advId))
      .map(advId => {
        const adv = advById.get(advId);
        const advTotals = emptyTotals();
        for (const t of tracks) {
          if (t.adventure_id !== advId) continue;
          addInto(advTotals, aggregateTracks([t]));
          if (!typeMap.has(t.type)) typeMap.set(t.type, true);
        }
        return {
          id: adv.id,
          name: adv.name,
          date: adv.adventure_date,
          distanceKm: Math.round(advTotals.distanceKm * 10) / 10,
          gainM: Math.round(advTotals.gainM),
          hours: Math.round((advTotals.seconds / 3600) * 10) / 10,
          photos: photosById.get(advId) || 0,
          waypoints: waypointsById.get(advId) || 0
        };
      });

    totals.distanceKm = byAdventure.reduce((a, x) => a + x.distanceKm, 0);
    totals.gainM = byAdventure.reduce((a, x) => a + x.gainM, 0);
    totals.hours = Math.round(byAdventure.reduce((a, x) => a + x.hours, 0) * 10) / 10;

    const byType = [...typeMap.keys()].map((type) => {
      const typeTracks = tracks.filter(t => t.type === type);
      const agg = aggregateTracks(typeTracks);
      return {
        type,
        distanceKm: Math.round(agg.distanceKm),
        hours: Math.round((agg.seconds / 3600) * 10) / 10,
        count: typeTracks.length
      };
    }).sort((a, b) => b.distanceKm - a.distanceKm);

    res.json({ totals, byAdventure, byType });
  } catch (error) {
    return handleError(error, res, { operation: 'getSeriesStats' });
  }
});

router.post('/',
  body('name').trim().notEmpty().withMessage('Name is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, description, start_date, end_date, adventureIds } = req.body;

      const series = await Series.create({
        name,
        description,
        start_date,
        end_date,
        user_id: req.user.id
      });

      if (adventureIds && Array.isArray(adventureIds)) {
        for (let i = 0; i < adventureIds.length; i++) {
          await SeriesAdventure.create({
            SeriesId: series.id,
            AdventureId: adventureIds[i],
            order: i
          });
        }
      }

      res.status(201).json({ series: { id: series.id, name: series.name } });
    } catch (error) {
      return handleError(error, res, { operation: 'createSeries' });
    }
  }
);

router.put('/:id',
  param('id').isUUID().withMessage('Invalid series ID'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { name, description, start_date, end_date } = req.body;

      const series = await Series.findOne({ where: { id } });
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (series.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await series.update({ name, description, start_date, end_date });

      res.json({ series: { id: series.id, name: series.name } });
    } catch (error) {
      return handleError(error, res, { operation: 'updateSeries' });
    }
  }
);

router.delete('/:id',
  param('id').isUUID().withMessage('Invalid series ID'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const series = await Series.findOne({ where: { id } });
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (series.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await SeriesAdventure.destroy({ where: { SeriesId: id } });
      await series.destroy();

      res.json({ message: 'Series deleted' });
    } catch (error) {
      return handleError(error, res, { operation: 'deleteSeries' });
    }
  }
);

router.put('/:id/adventures',
  param('id').isUUID().withMessage('Invalid series ID'),
  body('adventureIds').isArray().withMessage('Adventure IDs array is required'),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { adventureIds } = req.body;

      const series = await Series.findOne({ where: { id } });
      if (!series) {
        return res.status(404).json({ error: 'Series not found' });
      }

      if (series.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await SeriesAdventure.destroy({ where: { SeriesId: id } });

      for (let i = 0; i < adventureIds.length; i++) {
        await SeriesAdventure.create({
          SeriesId: id,
          AdventureId: adventureIds[i],
          order: i
        });
      }

      res.json({ message: 'Adventures updated' });
    } catch (error) {
      return handleError(error, res, { operation: 'updateSeriesAdventures' });
    }
  }
);

module.exports = router;