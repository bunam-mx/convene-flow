module.exports = (sequelize, DataTypes) => {
  const Events = sequelize.define("events", {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    placeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "places",
        key: "id",
      },
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    timeStart: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    timeEnd: {
      type: DataTypes.TIME,
      allowNull: false,
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    eventType: {
      type: DataTypes.ENUM(
        "cultural",
        "closure",
        "forum",
        "conversation",
        "keynote",
        "panel",
        "inauguration",
        "presentations"
      ),
      allowNull: true,
    },
    url: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  });

  Events.associate = (models) => {
    Events.belongsTo(models.places, {
      foreignKey: {
        name: "placeId",
        allowNull: false,
      },
      as: "place",
    });

    Events.belongsToMany(models.participants, {
      through: models.eventParticipants,
      foreignKey: "eventId",
      otherKey: "participantId",
      as: "participants",
    });

    Events.hasMany(models.eventParticipants, {
      foreignKey: "eventId",
      as: "participantLinks",
    });
  };

  return Events;
};