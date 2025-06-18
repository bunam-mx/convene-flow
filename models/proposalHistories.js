module.exports = (sequelize, DataTypes) => {
  const ProposalHistory = sequelize.define("proposalHistory", {
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

  ProposalHistory.associate = (models) => {
    ProposalHistory.belongsTo(models.users, {
      foreignKey: 'userId'
    });
    ProposalHistory.belongsTo(models.proposals, {
      foreignKey: 'proposalId'
    });
  };

  return ProposalHistory;
};
