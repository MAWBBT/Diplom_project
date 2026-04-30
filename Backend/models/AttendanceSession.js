const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('AttendanceSession', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    heldOn: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    groupName: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subjects', key: 'id' }
    },
    teacher: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    auditorium: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: { model: 'users', key: 'id' }
    }
  }, {
    tableName: 'attendance_sessions',
    timestamps: true
  });
};

