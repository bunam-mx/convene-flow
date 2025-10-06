module.exports = (sequelize, DataTypes) => {
  const EventParticipants = sequelize.define(
    "eventParticipants",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      eventId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "events",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      participantId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "participants",
          key: "id",
        },
        onDelete: "CASCADE",
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      isModerator: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["eventId", "participantId"],
        },
      ],
    }
  );

  EventParticipants.associate = (models) => {
    EventParticipants.belongsTo(models.events, {
      foreignKey: "eventId",
      as: "event",
    });
    EventParticipants.belongsTo(models.participants, {
      foreignKey: "participantId",
      as: "participant",
    });
  };

  return EventParticipants;
};
