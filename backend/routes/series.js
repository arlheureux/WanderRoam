const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { authMiddleware } = require('../middleware/auth');
const { handleError } = require('../middleware/errorHandler');
const { Series, SeriesAdventure, Adventure, GpxTrack, Picture, Waypoint, User } = require('../models');

const router = express.Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const series = await Series.findAll({
      where: { user_id: req.user.id },
      include: [{
        model: Adventure,
        as: 'adventures',
        through: { attributes: ['order'] },
        attributes: ['id']
      }],
      order: [['createdAt', 'DESC']]
    });

    const seriesWithStats = await Promise.all(series.map(async (s) => {
      const seriesAdventures = await SeriesAdventure.findAll({
        where: { SeriesId: s.id },
        order: [['order', 'ASC']]
      });

      const adventureIds = seriesAdventures.map(sa => sa.AdventureId);
      const adventures = await Adventure.findAll({
        where: { id: { [Op.in]: adventureIds } },
        attributes: ['id', 'adventure_date']
      });

      const adventuresWithOrder = seriesAdventures.map(sa => ({
        ...adventures.find(a => a.id === sa.AdventureId)?.toJSON(),
        order: sa.order
      })).filter(a => a.id);

      let totalPhotos = 0;
      let startDate = null;
      let endDate = null;
      
      if (adventuresWithOrder.length > 0) {
        for (const adv of adventuresWithOrder) {
          const pictures = await Picture.count({ where: { adventure_id: adv.id } });
          totalPhotos += pictures;

          if (adv.adventure_date) {
            if (!startDate || new Date(adv.adventure_date) < new Date(startDate)) {
              startDate = adv.adventure_date;
            }
            if (!endDate || new Date(adv.adventure_date) > new Date(endDate)) {
              endDate = adv.adventure_date;
            }
          }
        }
      }

      return {
        id: s.id,
        name: s.name,
        description: s.description,
        start_date: s.start_date || startDate,
        end_date: s.end_date || endDate,
        adventureCount: adventuresWithOrder.length,
        adventureIds: adventureIds,
        totalPhotos,
        isOwner: s.user_id === req.user.id,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      };
    }));

    res.json({ series: seriesWithStats });
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
        { model: Picture, as: 'Pictures' },
        { model: Waypoint, as: 'Waypoints' }
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
      
      return {
        ...advJson,
        order: sa.order,
        distance,
        pictureCount: advJson.Pictures?.length || 0,
        waypointCount: advJson.Waypoints?.length || 0
      };
    }).filter(Boolean);

    let totalDistance = 0;
    let totalPhotos = 0;
    let totalWaypoints = 0;
    const allTracks = [];
    let minLat = null, maxLat = null, minLng = null, maxLng = null;

    for (const adv of adventuresWithDetails) {
      totalDistance += adv.distance || 0;
      totalPhotos += adv.pictureCount || 0;
      totalWaypoints += adv.waypointCount || 0;
      
      adv.GpxTracks?.forEach(t => {
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