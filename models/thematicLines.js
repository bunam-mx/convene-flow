const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ThematicLines = sequelize.define('thematicLines', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    thematicLine: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true, // Assuming thematic lines should be unique
    },
    // Timestamps are managed by Sequelize by default (createdAt, updatedAt)
  }, {
    // Model options
    timestamps: true,
    // tableName: 'thematic_lines' // Optional: if you want a different table name
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
