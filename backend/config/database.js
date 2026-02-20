const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'adventureshare',
  process.env.DB_USER || 'adventureshare',
  process.env.DB_PASSWORD || 'adventureshare_password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

module.exports = sequelize;
