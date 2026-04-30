const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AttendanceRecord', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    sessionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'attendance_sessions', key: 'id' }
    },
    postgraduateId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'present',
      validate: {
        isIn: [['present', 'absent', 'late']]
      }
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    markedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'attendance_records',
    timestamps: true
  });
};

