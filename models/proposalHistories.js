module.exports = (sequelize, DataTypes) => {
  const proposalHistories = sequelize.define("proposalHistories", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    proposalId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'proposals',
        key: 'id'
      }
    }
  });

  proposalHistories.associate = (models) => {
    proposalHistories.belongsTo(models.users, {
      foreignKey: 'userId'
    });
    proposalHistories.belongsTo(models.proposals, {
      foreignKey: 'proposalId'
    });
  };

  return proposalHistories;
};
