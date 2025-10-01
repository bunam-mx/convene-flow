module.exports = (sequelize, DataTypes) => {
  const ThematicLines = sequelize.define('thematicLines', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    thematicLine: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    // Timestamps are managed by Sequelize by default (createdAt, updatedAt)
  }, {
    // Model options
    timestamps: true,
  });

  ThematicLines.associate = (models) => {
    // A thematic line can be associated with many proposals
    ThematicLines.hasMany(models.proposals, {
      foreignKey: {
        name: 'thematicLineId',
        allowNull: true, // Or false, depending on whether a proposal MUST have a thematic line
      },
      as: 'proposals',
    });
  };

  return ThematicLines;
};
