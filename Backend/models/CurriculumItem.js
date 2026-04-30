const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('CurriculumItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    planId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'curriculum_plans', key: 'id' }
    },
    subjectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'subjects', key: 'id' }
    },
    hours: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    controlForm: {
      type: DataTypes.STRING(60),
      allowNull: false
    },
    semester: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'curriculum_items',
    timestamps: true
  });
};

