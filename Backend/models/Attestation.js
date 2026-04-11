const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  return sequelize.define('Attestation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'users', key: 'id' }
    },
    periodLabel: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    decision: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    attestedAt: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    tableName: 'attestations',
    timestamps: true
  });
};
