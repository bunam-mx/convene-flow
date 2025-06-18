module.exports = (sequelize, type) => {
  const Sigeco = sequelize.define("sigeco", {
    id: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    name: type.STRING,
    lastname: type.STRING,
    entity: type.STRING,
    curp: type.STRING,
    studyLevel: type.ENUM(
      "LICENCIATURA",
      "MAESTRÍA",
      "DOCTORADO",
      "OTRO"
    ),
    userId: {
      type: type.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    }
  });

  Sigeco.associate = (models) => {
    Sigeco.belongsTo(models.users, {
      foreignKey: 'userId'
    });
  };

  return Sigeco;
};
