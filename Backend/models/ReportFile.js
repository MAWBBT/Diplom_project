const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('ReportFile', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    reportType: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    storedName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    originalName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    mimeType: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    generatedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    },
    params: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'report_files',
    timestamps: true
  });
};

