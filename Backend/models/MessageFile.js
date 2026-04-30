const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('MessageFile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    messageId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'messages', key: 'id' }
    },
    storedName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    mimeType: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    tableName: 'message_files',
    timestamps: true
  });
};

