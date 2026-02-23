const express = require('express');
const fs = require('fs');
const xml2js = require('xml2js');
const { Adventure, GpxTrack, Picture, Waypoint, User, AdventureShare } = require('../models');
const { authMiddleware } = require('../middleware/auth');
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

router.get('/', authMiddleware, async (req, res) => {
  try {
    const { sort = 'adventure_date', order = 'DESC' } = req.query;
    const sortField = ['adventure_date', 'createdAt', 'name'].includes(sort) ? sort : 'adventure_date';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const nullsOrder = sortOrder === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST';

    const myAdventures = await Adventure.findAll({
      where: { user_id: req.user.id },
      include: [
        {
          model: GpxTrack,
          attributes: ['id', 'name', 'type', 'color']
        },
        {
          model: Picture,
          attributes: ['id', 'filename', 'thumbnail_url']
        },
        {
          model: Waypoint,
          attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
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
        include: [
          {
            model: GpxTrack,
            attributes: ['id', 'name', 'type', 'color']
          },
          {
            model: Picture,
            attributes: ['id', 'filename', 'thumbnail_url']
          },
          {
            model: Waypoint,
            attributes: ['id', 'name', 'icon', 'latitude', 'longitude']
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

    const allAdventures = [...myAdventures, ...sharedAdventures].sort((a, b) => {
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

    const adventuresWithStats = allAdventures.map(adventure => {
      const gpxTracks = adventure.GpxTracks || [];
      const pictures = adventure.Pictures || [];

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
        pictureCount: pictures.length,
        gpxByType,
        isOwner: adventure.user_id === req.user.id,
        preview_picture_id: adventure.preview_picture_id,
        preview_picture: (adventure.preview_picture_id 
          ? pictures.find(p => p.id === adventure.preview_picture_id)
          : (pictures.length > 0 ? pictures[0] : null)
        ) ? {
          id: (adventure.preview_picture_id 
            ? pictures.find(p => p.id === adventure.preview_picture_id)
            : pictures[0]
          ).id,
          thumbnail_url: (adventure.preview_picture_id 
            ? pictures.find(p => p.id === adventure.preview_picture_id)
            : pictures[0]
          ).thumbnail_url
        } : null,
        createdAt: adventure.createdAt,
        updatedAt: adventure.updatedAt
      };
    });

    res.json({ adventures: adventuresWithStats });
  } catch (error) {
    console.error('Get adventures error:', error);
    res.status(500).json({ error: 'Failed to get adventures' });
  }
});

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const users = await User.findAll({
      where: { id: { [Op.ne]: req.user.id } },
      attributes: ['id', 'username']
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
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
    console.error('Get all GPX error:', error);
    res.status(500).json({ error: 'Failed to get GPX tracks' });
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
              console.error(`Failed to fetch preview for ${assetId}:`, e);
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

    res.json({ adventure: adventureData });
  } catch (error) {
    console.error('Get adventure error:', error);
    res.status(500).json({ error: 'Failed to get adventure' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, description, adventure_date, center_lat, center_lng, zoom } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

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
    console.error('Create adventure error:', error);
    res.status(500).json({ error: 'Failed to create adventure' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
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
    console.error('Update adventure error:', error);
    res.status(500).json({ error: 'Failed to update adventure' });
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
    console.error('Delete adventure error:', error);
    res.status(500).json({ error: 'Failed to delete adventure' });
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
    console.error('Upload GPX error:', error);
    res.status(500).json({ error: 'Failed to upload GPX' });
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
        console.error('Failed to delete GPX file:', err);
      }
    }

    await gpxTrack.destroy();

    res.json({ message: 'GPX track deleted' });
  } catch (error) {
    console.error('Delete GPX error:', error);
    res.status(500).json({ error: 'Failed to delete GPX' });
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
    console.error('Add picture error:', error);
    res.status(500).json({ error: 'Failed to add picture' });
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
    console.error('Delete picture error:', error);
    res.status(500).json({ error: 'Failed to delete picture' });
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
    console.error('Get shares error:', error);
    res.status(500).json({ error: 'Failed to get shares' });
  }
});

router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const adventure = await Adventure.findOne({
      where: { id: req.params.id, user_id: req.user.id }
    });

    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    const { username, permission } = req.body;

    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

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
    console.error('Share adventure error:', error);
    res.status(500).json({ error: 'Failed to share adventure' });
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
    console.error('Remove share error:', error);
    res.status(500).json({ error: 'Failed to remove share' });
  }
});

router.post('/:id/waypoints', authMiddleware, async (req, res) => {
  try {
    const { canEdit } = await getAdventureAccess(req.params.id, req.user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this adventure' });
    }

    const { name, icon, latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }

    const waypoint = await Waypoint.create({
      name: name || '',
      icon: icon || '📍',
      latitude,
      longitude,
      adventure_id: req.params.id
    });

    res.status(201).json({ waypoint });
  } catch (error) {
    console.error('Create waypoint error:', error);
    res.status(500).json({ error: 'Failed to create waypoint' });
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
    console.error('Update waypoint error:', error);
    res.status(500).json({ error: 'Failed to update waypoint' });
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
    console.error('Delete waypoint error:', error);
    res.status(500).json({ error: 'Failed to delete waypoint' });
  }
});

module.exports = router;
