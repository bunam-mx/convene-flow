module.exports = (sequelize, DataTypes) => {
  const eventAttendees = sequelize.define("eventAttendees", {
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
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "users",
        key: "id",
      },
    },
  });

  eventAttendees.associate = (models) => {
    eventAttendees.belongsTo(models.events, { foreignKey: 'eventId' });
    eventAttendees.belongsTo(models.users, { foreignKey: 'userId' });
  };

  return eventAttendees;
};
