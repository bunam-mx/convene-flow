const Sequelize = require("sequelize");
console.log("DATABASE", process.env.DATABASE);
const sequelize = new Sequelize(process.env.DATABASE, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD, {
  host: "localhost",
  dialect: "mariadb",
  timezone: "-06:00",
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const db = {};

db.Op = Sequelize.Op;
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.users = require("./models/users")(sequelize, Sequelize);
db.proposals = require("./models/proposals")(sequelize, Sequelize);
db.sigecos = require("./models/sigecos")(sequelize, Sequelize);
db.thematicLines = require("./models/thematicLines")(sequelize, Sequelize);
db.proposalHistories = require("./models/proposalHistories")(sequelize, Sequelize);

// Llamar a los métodos associate si existen
Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

sequelize
  .sync({
    alter: true, // Cambiado a false para evitar alteraciones automáticas
  })
  .then(() => {
    console.log("Database & tables updated!");
  });

module.exports = db;
