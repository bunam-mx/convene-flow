module.exports = (sequelize, DataTypes) => {
  const WorkshopAttendees = sequelize.define(
    "workshopAttendees",
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
      userId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: "users",
          key: "id",
        },
        onDelete: "CASCADE",
      },
    },
    {
      indexes: [
        {
          unique: true,
          fields: ["workshopId", "userId"],
        },
      ],
    }
  );

  WorkshopAttendees.associate = (models) => {
    WorkshopAttendees.belongsTo(models.workshops, {
      foreignKey: "workshopId",
      as: "workshop",
    });
    WorkshopAttendees.belongsTo(models.users, {
      foreignKey: "userId",
      as: "user",
    });
  };

  return WorkshopAttendees;
};