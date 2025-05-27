module.exports = (sequelize, type) => {
  return sequelize.define("sigeco", {
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
  });
};
