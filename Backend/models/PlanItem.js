const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('PlanItem', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    planId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'individual_plans', key: 'id' }
    },
    title: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    orderIdx: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'planned',
      validate: {
        isIn: [['planned', 'in_progress', 'done', 'overdue']]
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    supervisorNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'plan_items',
    timestamps: true
  });
};
