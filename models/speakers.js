module.exports = (sequelize, type) => {
	const Speakers = sequelize.define("speakers", {
		id: {
			type: type.INTEGER,
			primaryKey: true,
			autoIncrement: true,
			allowNull: false,
		},
		userId: {
			type: type.INTEGER,
			allowNull: false,
			unique: true,
			references: {
				model: "users",
				key: "id",
			},
		},
		order: {
			type: type.INTEGER,
			allowNull: false,
			defaultValue: 0,
		},
	});

	Speakers.associate = (models) => {
		Speakers.belongsTo(models.users, {
			foreignKey: "userId",
			as: "user",
		});
	};

	return Speakers;
};
