module.exports = (sequelize, DataTypes) => {
  const Participants = sequelize.define(
    "participants",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      institution: {
        type: DataTypes.STRING,
        allowNull: true,
      },
      bio: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    }
  );

  Participants.associate = (models) => {
    Participants.belongsToMany(models.events, {
      through: models.eventParticipants,
      foreignKey: "participantId",
      otherKey: "eventId",
      as: "events",
    });

    Participants.hasMany(models.eventParticipants, {
      foreignKey: "participantId",
      as: "eventLinks",
    });

    Participants.belongsToMany(models.workshops, {
      through: models.workshopParticipants,
      foreignKey: "participantId",
      otherKey: "workshopId",
      as: "workshops",
    });

    Participants.hasMany(models.workshopParticipants, {
      foreignKey: "participantId",
      as: "workshopLinks",
    });
  };

  return Participants;
};