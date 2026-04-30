const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('CurriculumPlan', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    programId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'programs', key: 'id' }
    },
    academicYear: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(300),
      allowNull: false
    }
  }, {
    tableName: 'curriculum_plans',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['programId', 'academicYear'] }
    ]
  });
};

