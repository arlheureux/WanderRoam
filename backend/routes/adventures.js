const express = require('express');
const fs = require('fs');
const xml2js = require('xml2js');
const { body, param, query } = require('express-validator');
const { Adventure, GpxTrack, Picture, Waypoint, User, AdventureShare, Tag } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { handleError, logger } = require('../middleware/errorHandler');
const { Op, Sequelize } = require('sequelize');
const sequelize = require('../config/database');

const router = express.Router();

const getAdventureAccess = async (adventureId, userId) => {
  const adventure = await Adventure.findByPk(adventureId);
  if (!adventure) return { adventure: null, canEdit: false, canView: false };
  
  if (adventure.user_id === userId) {
    return { adventure, canEdit: true, canView: true };
  }
  
  const share = await AdventureShare.findOne({
    where: { AdventureId: adventureId, UserId: userId }
  });
  
  if (!share) return { adventure: null, canEdit: false, canView: false };
  
  return { 
    adventure, 
    canEdit: share.permission === 'edit', 
    canView: share.permission === 'view' || share.permission === 'edit' 
  };
};

const parseGpx = async (filePath) => {
  const xml = fs.readFileSync(filePath, 'utf-8');
  const points = [];
  
  const trkptRegex = /<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  let match;
  
  while ((match = trkptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }
  
  const rteptRegex = /<rtept[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  while ((match = rteptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }
  
  const wptRegex = /<wpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"[^>]*>/g;
  while ((match = wptRegex.exec(xml)) !== null) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    
    let ele = null;
    let time = null;
    
    const eleMatch = xml.substring(match.index, match.index + 500).match(/<ele>([^<]+)<\/ele>/);
    if (eleMatch) ele = parseFloat(eleMatch[1]);
    
    const timeMatch = xml.substring(match.index, match.index + 500).match(/<time>([^<]+)<\/time>/);
    if (timeMatch) time = timeMatch[1];
    
    if (!isNaN(lat) && !isNaN(lng)) {
      points.push({ lat, lng, ele, time });
    }
  }

  return points;
};

const TYPE_COLORS = {
  walking: '#FF6B6B',
  hiking: '#FF9F43',
  cycling: '#4ECDC4',
  bus: '#A55EEA',
  metro: '#26DE81',
  train: '#45B7D1',
  boat: '#2D98DA',
  car: '#FC5C65',
  other: '#9B59B6'
};

router.get('/', authMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isIn(['adventure_date', 'createdAt', 'name']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['ASC', 'DESC']).withMessage('Order must be ASC or DESC'),
  validate
], async (req, res) => {
  try {
    const { sort = 'adventure_date', order = 'DESC', tags } = req.query;
    const sortField = ['adventure_date', 'createdAt', 'name'].includes(sort) ? sort : 'adventure_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const nullsOrder = sortOrder === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST';

    const tagFilter = tags ? tags.split(',').filter(t => t) : [];

    const myAdventures = await Adventure.findAll({
      where: { user_id: req.user.id },
      attributes: { include: [[sequelize.col('preview_picture_id'), 'preview_picture_id']] },
      include: [
        {
          model: GpxTrack,
          attributes: ['id', 'name', 'type', 'color']
        },
        {
          model: Waypoint,
          attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
        },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name', 'color', 'type'],
          through: { attributes: [] }
        }
      ],
      order: [[sequelize.literal(`"Adventure"."${sortField}" ${nullsOrder}`)]]
    });

    const sharedAdventureIds = await AdventureShare.findAll({
      where: { UserId: req.user.id },
      attributes: ['AdventureId']
    });
    const sharedIds = sharedAdventureIds.map(s => s.AdventureId);

    let sharedAdventures = [];
    if (sharedIds.length > 0) {
      sharedAdventures = await Adventure.findAll({
        where: { id: sharedIds },
        attributes: { include: [[sequelize.col('preview_picture_id'), 'preview_picture_id']] },
        include: [
          {
            model: GpxTrack,
            attributes: ['id', 'name', 'type', 'color']
          },
          {
            model: Waypoint,
            attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
          },
          {
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name', 'color', 'type'],
            through: { attributes: [] }
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'username']
          }
        ],
        order: [[sequelize.literal(`"Adventure"."${sortField}" ${nullsOrder}`)]]
      });
    }

    const allAdventures = [...myAdventures, ...sharedAdventures];

    if (tagFilter.length > 0) {
      const filtered = allAdventures.filter(adventure => {
        const adventureTags = adventure.tags || [];
        return tagFilter.some(tagId => adventureTags.some(t => t.id === tagId));
      });
      allAdventures.length = 0;
      allAdventures.push(...filtered);
    }

    allAdventures.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'adventure_date') {
        aVal = aVal ? new Date(aVal).getTime() : (sortOrder === 'ASC' ? Infinity : -Infinity);
        bVal = bVal ? new Date(bVal).getTime() : (sortOrder === 'ASC' ? Infinity : -Infinity);
      } else if (sortField === 'name') {
        aVal = (aVal || '').toLowerCase();
        bVal = (bVal || '').toLowerCase();
      } else {
        aVal = aVal ? new Date(aVal).getTime() : (sortOrder === 'ASC' ? Infinity : -Infinity);
        bVal = bVal ? new Date(bVal).getTime() : (sortOrder === 'ASC' ? Infinity : -Infinity);
      }
      
      if (sortOrder === 'ASC') {
        return aVal > bVal ? 1 : -1;
      }
      return aVal < bVal ? 1 : -1;
    });

    const allAdventureIds = allAdventures.map(a => a.id);

    let previewPictures = {};
    let pictureCounts = {};
    let firstPictures = {};

    if (allAdventureIds.length > 0) {
      const allPictures = await Picture.findAll({
        where: { adventure_id: allAdventureIds },
        attributes: ['id', 'adventure_id', 'thumbnail_url'],
        order: [['id', 'ASC']]
      });

      const picByAdventure = {};
      allPictures.forEach(p => {
        if (!picByAdventure[p.adventure_id]) {
          picByAdventure[p.adventure_id] = [];
        }
        picByAdventure[p.adventure_id].push(p);
      });

      Object.keys(picByAdventure).forEach(advId => {
        pictureCounts[advId] = picByAdventure[advId].length;
        if (picByAdventure[advId].length > 0) {
          firstPictures[advId] = { id: picByAdventure[advId][0].id, thumbnail_url: picByAdventure[advId][0].thumbnail_url };
        }
      });

      allPictures.forEach(p => {
        const adventure = allAdventures.find(a => a.id === p.adventure_id);
        if (adventure && p.id === adventure.preview_picture_id) {
          previewPictures[p.id] = { id: p.id, thumbnail_url: p.thumbnail_url };
        }
      });
    }

    const adventuresWithStats = allAdventures.map(adventure => {
      const gpxTracks = adventure.GpxTracks || [];
      const previewPic = previewPictures[adventure.preview_picture_id] || firstPictures[adventure.id] || null;
      const pictureCount = pictureCounts[adventure.id] || 0;

      const gpxByType = gpxTracks.reduce((acc, track) => {
        acc[track.type] = (acc[track.type] || 0) + 1;
        return acc;
      }, {});

      let center_lat = parseFloat(adventure.center_lat);
      let center_lng = parseFloat(adventure.center_lng);
      let zoom = adventure.zoom;

      if (gpxTracks.length > 0) {
        const allPoints = gpxTracks
          .filter(t => t.data && t.data.length)
          .flatMap(t => t.data);
        
        if (allPoints.length > 0) {
          const lats = allPoints.map(p => p.lat);
          const lngs = allPoints.map(p => p.lng);
          center_lat = (Math.min(...lats) + Math.max(...lats)) / 2;
          center_lng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
          
          const latRange = Math.max(...lats) - Math.min(...lats);
          const lngRange = Math.max(...lngs) - Math.min(...lngs);
          const maxRange = Math.max(latRange, lngRange);
          
          if (maxRange < 0.01) zoom = 15;
          else if (maxRange < 0.1) zoom = 12;
          else if (maxRange < 1) zoom = 9;
          else if (maxRange < 10) zoom = 6;
          else zoom = 4;
        }
      }

      return {
        id: adventure.id,
        name: adventure.name,
        description: adventure.description,
        adventure_date: adventure.adventure_date,
        center_lat,
        center_lng,
        zoom,
        gpxCount: gpxTracks.length,
        pictureCount: pictureCount,
        gpxByType,
        isOwner: adventure.user_id === req.user.id,
        preview_picture_id: adventure.preview_picture_id,
        preview_picture: previewPic,
        tags: (adventure.tags || []).map(t => ({ id: t.id, name: t.name, color: t.color, category: t.type || 'Custom' })),
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt
      };
    });

    res.json({ 
      adventures: adventuresWithStats
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getAdventures' });
  }
});

router.get('/users', authMiddleware, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  validate
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    
    const { count, rows } = await User.findAndCountAll({
      where: { id: { [Op.ne]: req.user.id } },
      attributes: ['id', 'username'],
      limit,
      offset
    });

    res.json({ 
      users: rows,
      pagination: {
        page,
        limit,
        total: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getUsers' });
  }
});

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { view = 'all' } = req.query;
    
    let adventureIds;
    let ownedIds;
    
    if (view === 'owned') {
      const owned = await Adventure.findAll({
        where: { user_id: req.user.id },
        attributes: ['id']
      });
      adventureIds = owned.map(a => a.id);
    } else if (view === 'shared') {
      const shared = await AdventureShare.findAll({
        where: { UserId: req.user.id },
        attributes: ['AdventureId']
      });
      adventureIds = shared.map(s => s.AdventureId);
      ownedIds = [];
    } else {
      const owned = await Adventure.findAll({
        where: { user_id: req.user.id },
        attributes: ['id']
      });
      const shared = await AdventureShare.findAll({
        where: { UserId: req.user.id },
        attributes: ['AdventureId']
      });
      ownedIds = owned.map(a => a.id);
      adventureIds = [...ownedIds, ...shared.map(s => s.AdventureId)];
    }

    if (adventureIds.length === 0) {
      return res.json({
        overview: { adventures: 0, photos: 0, waypoints: 0, tracks: 0, distance: 0 },
        byYear: [],
        byTransport: []
      });
    }

    const [totalAdventures, totalPhotos, totalWaypoints, totalTracks, totalDistance] = await Promise.all([
      Adventure.count({ where: { id: { [Op.in]: adventureIds } } }),
      Picture.count({ where: { adventure_id: { [Op.in]: adventureIds } } }),
      Waypoint.count({ where: { adventure_id: { [Op.in]: adventureIds } } }),
      GpxTrack.count({ where: { adventure_id: { [Op.in]: adventureIds } } }),
      GpxTrack.sum('distance', { where: { adventure_id: { [Op.in]: adventureIds } } })
    ]);

    const tracksByType = await GpxTrack.findAll({
      where: { adventure_id: { [Op.in]: adventureIds } },
      attributes: ['type', [sequelize.fn('SUM', sequelize.col('distance')), 'totalDistance'], [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['type'],
      raw: true
    });

    const adventuresWithDates = await Adventure.findAll({
      where: { id: { [Op.in]: adventureIds }, adventure_date: { [Op.ne]: null } },
      attributes: ['id', 'adventure_date']
    });

    const byYear = {};
    for (const adv of adventuresWithDates) {
      const year = new Date(adv.adventure_date).getFullYear();
      byYear[year] = (byYear[year] || 0) + 1;
    }

    const yearStats = Object.entries(byYear)
      .map(([year, count]) => ({ year: parseInt(year), count }))
      .sort((a, b) => b.year - a.year);

    const transportStats = tracksByType.map(t => ({
      type: t.type,
      count: parseInt(t.count),
      distance: parseFloat(t.totalDistance) || 0
    }));

    res.json({
      overview: {
        adventures: totalAdventures || 0,
        photos: totalPhotos || 0,
        waypoints: totalWaypoints || 0,
        tracks: totalTracks || 0,
        distance: totalDistance || 0
      },
      byYear: yearStats,
      byTransport: transportStats
    });
  } catch (error) {
    return handleError(error, res, { operation: 'getStats' });
  }
});

router.get('/all-gpx', authMiddleware, async (req, res) => {
  try {
    const myAdventures = await Adventure.findAll({
      where: { user_id: req.user.id },
      attributes: ['id', 'name', 'adventure_date', 'user_id'],
      include: [
        {
          model: GpxTrack,
          attributes: ['id', 'name', 'type', 'color', 'data', 'distance']
        }
      ]
    });

    const sharedAdventureIds = await AdventureShare.findAll({
      where: { UserId: req.user.id },
      attributes: ['AdventureId']
    });
    const sharedIds = sharedAdventureIds.map(s => s.AdventureId);

    let sharedAdventures = [];
    if (sharedIds.length > 0) {
      sharedAdventures = await Adventure.findAll({
        where: { id: sharedIds },
        attributes: ['id', 'name', 'adventure_date', 'user_id'],
        include: [
          {
            model: GpxTrack,
            attributes: ['id', 'name', 'type', 'color', 'data', 'distance']
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'username']
          }
        ]
      });
    }

    const allAdventures = [...myAdventures, ...sharedAdventures];

    const ADVENTURE_COLORS = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
      '#F8B500', '#00CED1', '#FF69B4', '#32CD32', '#FF8C00'
    ];

    const tracks = [];
    allAdventures.forEach((adventure, idx) => {
      const adventureColor = ADVENTURE_COLORS[idx % ADVENTURE_COLORS.length];
      const gpxTracks = adventure.GpxTracks || [];
      
      gpxTracks.forEach(track => {
        if (track.data && track.data.length > 0) {
          tracks.push({
            id: track.id,
            name: track.name,
            type: track.type,
            color: adventureColor,
            adventureId: adventure.id,
            adventureName: adventure.name,
            adventureDate: adventure.adventure_date,
            isOwner: adventure.user_id === req.user.id,
            ownerName: adventure.owner ? adventure.owner.username : null,
            data: track.data
          });
        }
      });
    });

    res.json({ tracks });
  } catch (error) {
    return handleError(error, res, { operation: 'getAllGpx' });
  }
});

router.get('/tags', authMiddleware, async (req, res) => {
  try {
    const tags = await Tag.findAll({
      order: [['type', 'ASC'], ['name', 'ASC']]
    });
    const tagsWithCategory = tags.map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      category: t.type || 'Custom'
    }));
    res.json({ tags: tagsWithCategory });
  } catch (error) {
    return handleError(error, res, { operation: 'getTags' });
  }
});

router.post('/tags', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 50 }).withMessage('Name must be 50 characters or less'),
  body('category').optional().trim().isLength({ max: 30 }).withMessage('Category must be 30 characters or less'),
  validate
], async (req, res) => {
  try {
    const { name, category } = req.body;

    const existingTag = await Tag.findOne({ where: { name } });
    if (existingTag) {
      return res.status(400).json({ error: 'Tag with this name already exists' });
    }

    const randomColor = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');

    const tag = await Tag.create({
      name,
      type: category || 'custom',
      color: randomColor
    });

    res.json({ tag: { id: tag.id, name: tag.name, color: tag.color, category: tag.type } });
  } catch (error) {
    return handleError(error, res, { operation: 'createTag' });
  }
});

router.delete('/tags/:id', authMiddleware, async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    
    if (!tag) {
      return res.status(404).json({ error: 'Tag not found' });
    }

    await tag.destroy();
    
    res.json({ message: 'Tag deleted successfully' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteTag' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    let adventure = await Adventure.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      },
      include: [
        {
          model: GpxTrack,
          attributes: ['id', 'name', 'type', 'color', 'data', 'distance']
        },
        {
          model: Picture,
          attributes: ['id', 'immich_asset_id', 'filename', 'latitude', 'longitude', 'taken_at', 'thumbnail_url']
        },
        {
          model: Waypoint,
          attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
        },
        {
          model: Tag,
          as: 'tags',
          attributes: ['id', 'name', 'color', 'type'],
          through: { attributes: [] }
        }
      ]
    });

    if (!adventure) {
      const share = await AdventureShare.findOne({
        where: {
          AdventureId: req.params.id,
          UserId: req.user.id
        }
      });

      if (!share) {
        return res.status(404).json({ error: 'Adventure not found' });
      }

      adventure = await Adventure.findOne({
        where: { id: req.params.id },
        include: [
          {
            model: GpxTrack,
            attributes: ['id', 'name', 'type', 'color', 'data', 'distance']
          },
          {
            model: Picture,
            attributes: ['id', 'immich_asset_id', 'filename', 'latitude', 'longitude', 'taken_at', 'thumbnail_url']
          },
          {
            model: Waypoint,
            attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
          },
          {
            model: Tag,
            as: 'tags',
            attributes: ['id', 'name', 'color', 'type'],
            through: { attributes: [] }
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'username']
          }
        ]
      });

      if (!adventure) {
        return res.status(404).json({ error: 'Adventure not found' });
      }

      adventure.dataValues.isOwner = false;
      adventure.dataValues.permission = share.permission;
    } else {
      adventure.dataValues.isOwner = true;
    }

    const pictures = adventure.Pictures || [];
    const thumbnails = {};

    if (pictures.length > 0) {
      const owner = await User.findByPk(adventure.user_id);
      
      if (owner.immich_url && owner.immich_api_key) {
        const assetIds = pictures.map(p => p.immich_asset_id).filter(Boolean);
        
        await Promise.all(
          assetIds.map(async (assetId) => {
            try {
              const response = await fetch(
                `${owner.immich_url}/api/assets/${assetId}/thumbnail?size=preview`,
                {
                  headers: {
                    'x-api-key': owner.immich_api_key
                  }
                }
              );
              if (response.ok) {
                const buffer = await response.arrayBuffer();
                const base64 = Buffer.from(buffer).toString('base64');
                const contentType = response.headers.get('content-type') || 'image/jpeg';
                thumbnails[assetId] = `data:${contentType};base64,${base64}`;
              }
            } catch (e) {
              logger.warn(`Failed to fetch preview for ${assetId}: ${e.message}`);
            }
          })
        );

        await Promise.all(
          pictures.map(async (pic) => {
            if (pic.immich_asset_id && thumbnails[pic.immich_asset_id]) {
              pic.thumbnail_url = thumbnails[pic.immich_asset_id];
              await pic.save();
            }
          })
        );
      }
    }

    const adventureData = adventure.toJSON();
    adventureData.Pictures = adventureData.Pictures.map(p => ({
      ...p,
      thumbnail_base64: thumbnails[p.immich_asset_id] || null,
      full_url: p.immich_asset_id ? `/api/immich/full/${p.immich_asset_id}` : null,
      thumbnail_url: p.thumbnail_url || null
    }));
    adventureData.tags = (adventureData.tags || []).map(t => ({
      id: t.id,
      name: t.name,
      color: t.color,
      category: t.type || 'Custom'
    }));

    res.json({ adventure: adventureData });
  } catch (error) {
    return handleError(error, res, { operation: 'getAdventure' });
  }
});

router.post('/', authMiddleware, [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description must be 5000 characters or less'),
  body('adventure_date').optional().isISO8601().withMessage('Invalid date format'),
  body('center_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('center_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('zoom').optional().isInt({ min: 1, max: 18 }).withMessage('Zoom must be between 1 and 18'),
  validate
], async (req, res) => {
  try {
    const { name, description, adventure_date, center_lat, center_lng, zoom } = req.body;

    const adventure = await Adventure.create({
      name,
      description,
      adventure_date,
      center_lat: center_lat || 46.2276,
      center_lng: center_lng || 2.2137,
      zoom: zoom || 10,
      user_id: req.user.id
    });

    res.status(201).json({ adventure });
  } catch (error) {
    return handleError(error, res, { operation: 'createAdventure' });
  }
});

router.put('/:id', authMiddleware, [
  param('id').isUUID().withMessage('Invalid adventure ID'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('description').optional().isLength({ max: 5000 }).withMessage('Description must be 5000 characters or less'),
  body('adventure_date').optional().isISO8601().withMessage('Invalid date format'),
  body('center_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('center_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('zoom').optional().isInt({ min: 1, max: 18 }).withMessage('Zoom must be between 1 and 18'),
  body('preview_picture_id').optional().isUUID().withMessage('Invalid picture ID'),
  validate
], async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const { name, description, adventure_date, center_lat, center_lng, zoom, preview_picture_id } = req.body;

    if (name !== undefined) adventure.name = name;
    if (description !== undefined) adventure.description = description;
    if (adventure_date !== undefined) adventure.adventure_date = adventure_date;
    if (center_lat !== undefined) adventure.center_lat = center_lat;
    if (center_lng !== undefined) adventure.center_lng = center_lng;
    if (zoom !== undefined) adventure.zoom = zoom;
    if (preview_picture_id !== undefined) adventure.preview_picture_id = preview_picture_id;

    await adventure.save();

    res.json({ adventure });
  } catch (error) {
    return handleError(error, res, { operation: 'updateAdventure' });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const adventure = await Adventure.findOne({
      where: {
        id: req.params.id,
        user_id: req.user.id
      }
    });

    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    await adventure.destroy();

    res.json({ message: 'Adventure deleted' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteAdventure' });
  }
});

router.post('/:id/gpx', authMiddleware, async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'GPX file is required' });
    }

    const gpxFile = req.file;
    const { name, type } = req.body;

    const gpxType = type || 'hiking';
    const color = TYPE_COLORS[gpxType] || TYPE_COLORS.other;

    const gpxData = await parseGpx(gpxFile.path);

    const gpxTrack = await GpxTrack.create({
      name: name || gpxFile.originalname.replace('.gpx', ''),
      type: gpxType,
      color,
      file_path: gpxFile.path,
      data: gpxData,
      adventure_id: adventure.id
    });

    res.status(201).json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'uploadGpx' });
  }
});

router.delete('/:id/gpx/:gpxId', authMiddleware, async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const gpxTrack = await GpxTrack.findOne({
      where: {
        id: req.params.gpxId,
        adventure_id: adventure.id
      }
    });

    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    if (gpxTrack.file_path) {
      try {
        if (fs.existsSync(gpxTrack.file_path)) {
          fs.unlinkSync(gpxTrack.file_path);
        }
      } catch (err) {
        logger.warn(`Failed to delete GPX file: ${err.message}`);
      }
    }

    await gpxTrack.destroy();

    res.json({ message: 'GPX track deleted' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteGpx' });
  }
});

router.post('/:id/pictures', authMiddleware, async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const { immich_asset_id, filename, latitude, longitude, taken_at, thumbnail_url } = req.body;

    const picture = await Picture.create({
      immich_asset_id,
      filename,
      latitude,
      longitude,
      taken_at,
      thumbnail_url,
      adventure_id: adventure.id
    });

    res.status(201).json({ picture });
  } catch (error) {
    return handleError(error, res, { operation: 'addPicture' });
  }
});

router.delete('/:id/pictures/:pictureId', authMiddleware, async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const picture = await Picture.findOne({
      where: {
        id: req.params.pictureId,
        adventure_id: adventure.id
      }
    });

    if (!picture) {
      return res.status(404).json({ error: 'Picture not found' });
    }

    await picture.destroy();

    res.json({ message: 'Picture deleted' });
  } catch (error) {
    return handleError(error, res, { operation: 'deletePicture' });
  }
});

router.get('/:id/share', authMiddleware, async (req, res) => {
  try {
    const adventure = await Adventure.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    const shares = await AdventureShare.findAll({
      where: { AdventureId: adventure.id },
      include: [{ model: User, as: 'User', attributes: ['id', 'username'] }]
    });

    res.json({ shares: shares.map(s => ({
      id: s.id,
      userId: s.User.id,
      username: s.User.username,
      permission: s.permission
    })) });
  } catch (error) {
    return handleError(error, res, { operation: 'getShares' });
  }
});

router.post('/:id/share', authMiddleware, [
  param('id').isUUID().withMessage('Invalid adventure ID'),
  body('username').notEmpty().withMessage('Username is required').trim(),
  body('permission').optional().isIn(['view', 'edit']).withMessage('Permission must be view or edit'),
  validate
], async (req, res) => {
  try {
    const adventure = await Adventure.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    const { username, permission } = req.body;

    const user = await User.findOne({ where: { username } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot share with yourself' });
    }

    const existingShare = await AdventureShare.findOne({
      where: { AdventureId: adventure.id, UserId: user.id }
    });

    if (existingShare) {
      existingShare.permission = permission || 'view';
      await existingShare.save();
    } else {
      await AdventureShare.create({
        AdventureId: adventure.id,
        UserId: user.id,
        permission: permission || 'view'
      });
    }

    res.json({ success: true });
  } catch (error) {
    return handleError(error, res, { operation: 'shareAdventure' });
  }
});

router.delete('/:id/share/:shareId', authMiddleware, async (req, res) => {
  try {
    const adventure = await Adventure.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    const share = await AdventureShare.findOne({
      where: { id: req.params.shareId, AdventureId: adventure.id }
    });

    if (!share) {
      return res.status(404).json({ error: 'Share not found' });
    }

    await share.destroy();

    res.json({ success: true });
  } catch (error) {
    return handleError(error, res, { operation: 'removeShare' });
  }
});

router.post('/:id/waypoints', authMiddleware, [
  param('id').isUUID().withMessage('Invalid adventure ID'),
  body('latitude').notEmpty().withMessage('Latitude is required').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').notEmpty().withMessage('Longitude is required').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('icon').optional().trim().isLength({ max: 10 }).withMessage('Icon must be 10 characters or less'),
  validate
], async (req, res) => {
  try {
    const { canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const { name, icon, latitude, longitude } = req.body;

    const waypoint = await Waypoint.create({
      name: name || '',
      icon: icon || '📍',
      latitude,
      longitude,
      adventure_id: req.params.id
    });

    res.status(201).json({ waypoint });
  } catch (error) {
    return handleError(error, res, { operation: 'createWaypoint' });
  }
});

router.put('/:id/waypoints/:waypointId', authMiddleware, async (req, res) => {
  try {
    const { canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const waypoint = await Waypoint.findOne({
      where: { id: req.params.waypointId, adventure_id: req.params.id }
    });

    if (!waypoint) {
      return res.status(404).json({ error: 'Waypoint not found' });
    }

    const { name, icon } = req.body;

    if (name !== undefined) waypoint.name = name;
    if (icon !== undefined) waypoint.icon = icon;

    await waypoint.save();

    res.json({ waypoint });
  } catch (error) {
    return handleError(error, res, { operation: 'updateWaypoint' });
  }
});

router.delete('/:id/waypoints/:waypointId', authMiddleware, async (req, res) => {
  try {
    const { canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const waypoint = await Waypoint.findOne({
      where: { id: req.params.waypointId, adventure_id: req.params.id }
    });

    if (!waypoint) {
      return res.status(404).json({ error: 'Waypoint not found' });
    }

    await waypoint.destroy();

    res.json({ message: 'Waypoint deleted successfully' });
  } catch (error) {
    return handleError(error, res, { operation: 'deleteWaypoint' });
  }
});

router.put('/:id/tags', authMiddleware, [
  param('id').isUUID().withMessage('Invalid adventure ID'),
  body('tagIds').isArray().withMessage('tagIds must be an array').custom(val => val.every(id => typeof id === 'string' && id.match(/^[0-9a-f-]+$/))).withMessage('Invalid tag IDs'),
  validate
], async (req, res) => {
  try {
    const { adventure, canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const { tagIds } = req.body;

    const tags = await Tag.findAll({
      where: { id: tagIds }
    });

    await adventure.setTags(tags);

    const updatedTags = await adventure.getTags();
    res.json({ tags: updatedTags.map(t => ({ id: t.id, name: t.name, color: t.color, category: t.type || 'Custom' })) });
  } catch (error) {
    return handleError(error, res, { operation: 'updateTags' });
  }
});

module.exports = router;
