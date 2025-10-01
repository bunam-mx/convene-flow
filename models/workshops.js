module.exports = (sequelize, DataTypes) => {
	const Workshops = sequelize.define("workshops", {
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
		purpose: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		keyPoints: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		participantDeliverable: {
			type: DataTypes.TEXT,
			allowNull: false,
		},
		participantCapacity: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
		registeredParticipants: {
			type: DataTypes.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	});

	Workshops.associate = (models) => {
		Workshops.belongsToMany(models.users, {
			through: "workshopAttendees",
			foreignKey: "workshopId",
			otherKey: "userId",
			as: "attendees",
		});
		Workshops.hasMany(models.workshopAttendees, {
			foreignKey: "workshopId",
			as: "attendeeLinks",
		});
	};

	return Workshops;
};
