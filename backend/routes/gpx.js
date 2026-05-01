const express = require('express');
const { param, body } = require('express-validator');
const { GpxTrack } = require('../models');
const { authMiddleware } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { handleError } = require('../middleware/errorHandler');
const { getAdventureAccess } = require('./adventures');

const router = express.Router();

router.put('/:id', authMiddleware, [
  param('id').isUUID().withMessage('Invalid GPX track ID'),
  body('name').optional().trim().isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
  body('type').optional().isIn(['walking', 'hiking', 'cycling', 'bus', 'metro', 'train', 'boat', 'car', 'other']).withMessage('Invalid track type'),
  body('color').optional().isHexColor().withMessage('Invalid color format'),
  body('data').optional().isArray().withMessage('Data must be an array'),
  body('adventure_id').optional().isUUID().withMessage('Invalid adventure ID'),
  validate
], async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);
    
    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    const { canEdit } = await getAdventureAccess(gpxTrack.adventure_id, req.user.id);
    
    if (!canEdit) {
      return res.status(403).json({ error: 'You do not have permission to edit this GPX track' });
    }

    const { name, type, color, data, adventure_id } = req.body;

    if (name !== undefined) gpxTrack.name = name;
    if (type !== undefined) gpxTrack.type = type;
    if (color !== undefined) gpxTrack.color = color;
    if (data !== undefined) gpxTrack.data = data;
    if (adventure_id !== undefined) gpxTrack.adventure_id = adventure_id;

    await gpxTrack.save();

    res.json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'updateGpxTrack' });
  }
});

router.get('/:id', authMiddleware, [
  param('id').isUUID().withMessage('Invalid GPX track ID'),
  validate
], async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);
    
    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    const { canView } = await getAdventureAccess(gpxTrack.adventure_id, req.user.id);
    
    if (!canView) {
      return res.status(403).json({ error: 'You do not have permission to view this GPX track' });
    }

    res.json({ gpxTrack });
  } catch (error) {
    return handleError(error, res, { operation: 'getGpxTrack' });
  }
});

router.get('/:id/data', authMiddleware, [
  param('id').isUUID().withMessage('Invalid GPX track ID'),
  validate
], async (req, res) => {
  try {
    const gpxTrack = await GpxTrack.findByPk(req.params.id);
    
    if (!gpxTrack) {
      return res.status(404).json({ error: 'GPX track not found' });
    }

    const { canView } = await getAdventureAccess(gpxTrack.adventure_id, req.user.id);
    
    if (!canView) {
      return res.status(403).json({ error: 'You do not have permission to view this GPX track' });
    }

    res.json({ data: gpxTrack.data });
  } catch (error) {
    return handleError(error, res, { operation: 'getGpxTrackData' });
  }
});

module.exports = router;
