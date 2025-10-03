module.exports = (sequelize, DataTypes) => {
  const WorkshopParticipants = sequelize.define(
    "workshopParticipants",
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      workshopId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "workshops",
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
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["workshopId", "participantId"],
        },
      ],
    }
  );

  WorkshopParticipants.associate = (models) => {
    WorkshopParticipants.belongsTo(models.workshops, {
      foreignKey: "workshopId",
      as: "workshop",
    });
    WorkshopParticipants.belongsTo(models.participants, {
      foreignKey: "participantId",
      as: "participant",
    });
  };

  return WorkshopParticipants;
};