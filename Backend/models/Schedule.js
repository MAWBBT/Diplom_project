const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Schedule = sequelize.define('Schedule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    dayOfWeek: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    time: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    subject: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    teacher: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    auditorium: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    tableName: 'schedules',
    timestamps: true
  });
  return Schedule;
};