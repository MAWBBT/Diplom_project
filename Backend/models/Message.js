const { DataTypes } = require('sequelize');
module.exports = (sequelize) => {
  const Message = sequelize.define('Message', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    topic: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    text: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    messageType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'personal',
      validate: {
        isIn: [['personal', 'supervisor_feedback']]
      }
    },
    feedbackKind: {
      type: DataTypes.STRING(40),
      allowNull: true,
      validate: {
        isIn: [['review', 'conclusion', 'recommendation']]
      }
    }
  }, {
    tableName: 'messages',
    timestamps: true
  });
  return Message;
};