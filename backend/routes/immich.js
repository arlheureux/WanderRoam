const express = require('express');
const { User, Adventure } = require('../models');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const fetchWithAuth = async (url, apiKey) => {
  const response = await fetch(url, {
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Immich API error: ${response.status}`);
  }
  
  return response.json();
};

const fetchWithAuthPost = async (url, apiKey, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    throw new Error(`Immich API error: ${response.status}`);
  }
  
  return response.json();
};

router.get('/status', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.json({ connected: false });
    }

    try {
      const result = await fetchWithAuth(
        `${user.immich_url}/api/albums`,
        user.immich_api_key
      );
      
      res.json({ 
        connected: Array.isArray(result),
        url: user.immich_url
      });
    } catch (error) {
      res.json({ 
        connected: false,
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Immich status error:', error);
    res.status(500).json({ error: 'Failed to check Immich status' });
  }
});

router.get('/albums', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const albums = await fetchWithAuth(
      `${user.immich_url}/api/albums`,
      user.immich_api_key
    );

    const processedAlbums = await Promise.all(albums.map(async (album) => {
      let thumbId = album.albumThumbnailAssetId || album.thumbnail?.id;
      
      if (!thumbId && album.assetCount > 0) {
        try {
          const albumData = await fetchWithAuth(
            `${user.immich_url}/api/albums/${album.id}?withoutAssets=false`,
            user.immich_api_key
          );
          if (albumData.assets && albumData.assets.length > 0) {
            thumbId = albumData.assets[0].id;
          }
        } catch (e) {
          console.error(`Failed to get first asset for album ${album.id}:`, e);
        }
      }

      if (!thumbId && album.assetCount > 0) {
        try {
          const assetsResponse = await fetch(
            `${user.immich_url}/api/albums/${album.id}/assets`,
            { headers: { 'x-api-key': user.immich_api_key } }
          );
          if (assetsResponse.ok) {
            const assetsData = await assetsResponse.json();
            if (assetsData.length > 0) {
              thumbId = assetsData[0].id;
            }
          }
        } catch (e) {
          console.error(`Failed to get assets for album ${album.id}:`, e);
        }
      }

      return {
        id: album.id,
        albumName: album.albumName,
        assetCount: album.assetCount || 0,
        albumThumbnailAssetId: thumbId,
        thumbnailUrl: thumbId 
          ? `/api/immich/thumbnail/${thumbId}?size=thumbnail`
          : null
      };
    }));

    res.json({ albums: processedAlbums });
  } catch (error) {
    console.error('Get Immich albums error:', error);
    res.status(500).json({ error: 'Failed to get Immich albums' });
  }
});

router.get('/assets', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const { albumId } = req.query;
    
    let url;
    if (albumId) {
      url = `${user.immich_url}/api/albums/${albumId}`;
    } else {
      url = `${user.immich_url}/api/albums`;
    }

    const data = await fetchWithAuth(url, user.immich_api_key);

    let assets = [];
    
    if (albumId && data.assets) {
      assets = data.assets;
    } else if (!albumId && Array.isArray(data)) {
      const albumsWithAssets = await Promise.all(
        data.slice(0, 10).map(async (album) => {
          try {
            const albumUrl = `${user.immich_url}/api/albums/${album.id}`;
            const albumData = await fetchWithAuth(albumUrl, user.immich_api_key);
            return albumData.assets || [];
          } catch (e) {
            return [];
          }
        })
      );
      assets = albumsWithAssets.flat();
    }

    const processedAssets = assets
      .filter(a => a.exifInfo && a.exifInfo.latitude && a.exifInfo.longitude)
      .map(a => ({
        id: a.id,
        filename: a.originalFileName,
        latitude: a.exifInfo.latitude,
        longitude: a.exifInfo.longitude,
        takenAt: a.exifInfo.dateTimeOriginal || a.createdAt,
        thumbnailUrl: `/api/immich/thumbnail/${a.id}?size=preview`,
        type: a.type
      }));

    res.json({ assets: processedAssets });
  } catch (error) {
    console.error('Get Immich assets error:', error);
    res.status(500).json({ error: 'Failed to get Immich assets' });
  }
});

router.post('/connect', authMiddleware, async (req, res) => {
  try {
    const { immich_url, immich_api_key } = req.body;

    if (!immich_url || !immich_api_key) {
      return res.status(400).json({ error: 'URL and API key are required' });
    }

    const normalizedUrl = immich_url.replace(/\/$/, '');

    try {
      const result = await fetchWithAuth(
        `${normalizedUrl}/api/albums`,
        immich_api_key
      );

      if (!Array.isArray(result)) {
        return res.status(400).json({ error: 'Invalid Immich credentials' });
      }

      const user = await User.findByPk(req.user.id);
      user.immich_url = normalizedUrl;
      user.immich_api_key = immich_api_key;
      await user.save();

      res.json({ 
        success: true,
        url: normalizedUrl 
      });
    } catch (error) {
      return res.status(400).json({ 
        error: 'Failed to connect to Immich',
        details: error.message 
      });
    }
  } catch (error) {
    console.error('Connect to Immich error:', error);
    res.status(500).json({ error: 'Failed to connect to Immich' });
  }
});

router.get('/asset/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const asset = await fetchWithAuth(
      `${user.immich_url}/api/assets/${req.params.id}`,
      user.immich_api_key
    );

    res.json({
      asset: {
        id: asset.id,
        filename: asset.originalFileName,
        latitude: asset.exifInfo?.latitude,
        longitude: asset.exifInfo?.longitude,
        takenAt: asset.exifInfo?.dateTimeOriginal || asset.createdAt,
        thumbnailUrl: `${user.immich_url}/api/assets/${asset.id}/thumbnail?size=preview`,
        fullUrl: `${user.immich_url}/api/assets/${asset.id}`
      }
    });
  } catch (error) {
    console.error('Get Immich asset error:', error);
    res.status(500).json({ error: 'Failed to get Immich asset' });
  }
});

router.get('/thumbnails', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const { ids } = req.query;
    if (!ids) {
      return res.json({ thumbnails: {} });
    }

    const assetIds = ids.split(',');
    const thumbnails = {};

    await Promise.all(
      assetIds.map(async (assetId) => {
        try {
          const response = await fetch(
            `${user.immich_url}/api/assets/${assetId.trim()}/thumbnail?size=thumbnail`,
            {
              headers: {
                'x-api-key': user.immich_api_key
              }
            }
          );

          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const base64 = Buffer.from(buffer).toString('base64');
            const contentType = response.headers.get('content-type') || 'image/jpeg';
            thumbnails[assetId.trim()] = `data:${contentType};base64,${base64}`;
          }
        } catch (e) {
          console.error(`Failed to fetch thumbnail for ${assetId}:`, e);
        }
      })
    );

    res.json({ thumbnails });
  } catch (error) {
    console.error('Get thumbnails error:', error);
    res.status(500).json({ error: 'Failed to fetch thumbnails' });
  }
});

router.get('/thumbnail/:assetId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const { assetId } = req.params;
    const size = req.query.size || 'thumbnail';
    
    const response = await fetch(
      `${user.immich_url}/api/assets/${assetId}/thumbnail?size=${size}`,
      {
        headers: {
          'x-api-key': user.immich_api_key
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch thumbnail');
    }

    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Get thumbnail error:', error);
    res.status(500).send('Failed to fetch thumbnail');
  }
});

router.get('/full/:assetId', authMiddleware, async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    
    if (!user.immich_url || !user.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured' });
    }

    const { assetId } = req.params;
    
    const response = await fetch(
      `${user.immich_url}/api/assets/${assetId}/original`,
      {
        headers: {
          'x-api-key': user.immich_api_key
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch full image');
    }

    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Get full image error:', error);
    res.status(500).send('Failed to fetch full image');
  }
});

router.get('/full/:adventureId/:assetId', authMiddleware, async (req, res) => {
  try {
    const { adventureId, assetId } = req.params;
    
    const adventure = await Adventure.findByPk(adventureId);
    if (!adventure) {
      return res.status(404).json({ error: 'Adventure not found' });
    }

    const owner = await User.findByPk(adventure.user_id);
    
    if (!owner.immich_url || !owner.immich_api_key) {
      return res.status(400).json({ error: 'Immich not configured by adventure owner' });
    }
    
    const response = await fetch(
      `${owner.immich_url}/api/assets/${assetId}/original`,
      {
        headers: {
          'x-api-key': owner.immich_api_key
        }
      }
    );

    if (!response.ok) {
      return res.status(response.status).send('Failed to fetch full image');
    }

    res.set('Content-Type', response.headers.get('content-type') || 'image/jpeg');
    const buffer = await response.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Get full image error:', error);
    res.status(500).send('Failed to fetch full image');
  }
});

module.exports = router;
