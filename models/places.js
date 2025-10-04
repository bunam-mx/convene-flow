module.exports = (sequelize, DataTypes) => {
  const Places = sequelize.define("places", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    placeName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  });

  Places.associate = (models) => {
    Places.hasMany(models.events, {
      foreignKey: {
        name: "placeId",
        allowNull: false,
      },
      as: "events",
    });

    Places.hasMany(models.workshops, {
      foreignKey: {
        name: "placeId",
        allowNull: false,
      },
      as: "workshops",
    });
  };

  return Places;
};