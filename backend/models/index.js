const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password_hash: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isAdmin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  immich_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  immich_api_key: {
    type: DataTypes.STRING,
    allowNull: true
  }
});

const Adventure = sequelize.define('Adventure', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  adventure_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  center_lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    defaultValue: 46.2276
  },
  center_lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    defaultValue: 2.2137
  },
  zoom: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  preview_picture_id: {
    type: DataTypes.UUID,
    allowNull: true
  }
});

const GpxTrack = sequelize.define('GpxTrack', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('walking', 'hiking', 'cycling', 'bus', 'metro', 'train', 'boat', 'car', 'other'),
    defaultValue: 'walking'
  },
  color: {
    type: DataTypes.STRING,
    defaultValue: '#FF6B6B'
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: true
  },
  data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  distance: {
    type: DataTypes.FLOAT,
    allowNull: true
  }
});

const Picture = sequelize.define('Picture', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  immich_asset_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  filename: {
    type: DataTypes.STRING,
    allowNull: true
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  taken_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  thumbnail_url: {
    type: DataTypes.TEXT,
    allowNull: true
  }
});

const Waypoint = sequelize.define('Waypoint', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING,
    defaultValue: '📍'
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false
  }
});

const Tag = sequelize.define('Tag', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  color: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Custom'
  }
});

const AdventureShare = sequelize.define('AdventureShare', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  permission: {
    type: DataTypes.ENUM('view', 'edit'),
    defaultValue: 'view'
  },
  AdventureId: {
    type: DataTypes.UUID,
    allowNull: false
  },
  UserId: {
    type: DataTypes.UUID,
    allowNull: false
  }
});

User.hasMany(Adventure, { foreignKey: 'user_id' });
Adventure.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Adventure.hasMany(GpxTrack, { foreignKey: 'adventure_id', onDelete: 'CASCADE' });
GpxTrack.belongsTo(Adventure, { foreignKey: 'adventure_id' });

Adventure.hasMany(Picture, { foreignKey: 'adventure_id', onDelete: 'CASCADE' });
Picture.belongsTo(Adventure, { foreignKey: 'adventure_id' });

Adventure.hasMany(Waypoint, { foreignKey: 'adventure_id', onDelete: 'CASCADE' });
Waypoint.belongsTo(Adventure, { foreignKey: 'adventure_id' });

Adventure.belongsToMany(Tag, { through: 'AdventureTags', as: 'tags' });
Tag.belongsToMany(Adventure, { through: 'AdventureTags', as: 'adventures' });

Adventure.belongsToMany(User, { through: AdventureShare, as: 'sharedWith' });
User.belongsToMany(Adventure, { through: AdventureShare, as: 'sharedAdventures' });

AdventureShare.belongsTo(User, { foreignKey: 'UserId', as: 'User' });
AdventureShare.belongsTo(Adventure, { foreignKey: 'AdventureId', as: 'Adventure' });

module.exports = {
  sequelize,
  User,
  Adventure,
  GpxTrack,
  Picture,
  Waypoint,
  Tag,
  AdventureShare
};
