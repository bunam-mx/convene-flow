const Sequelize = require("sequelize");
console.log("DATABASE", process.env.DATABASE);
const sequelize = new Sequelize(process.env.DATABASE, process.env.DATABASE_USER, process.env.DATABASE_PASSWORD, {
  host: "localhost",
  dialect: "mariadb",
  timezone: "-05:00",
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
db.sigecos = require("./models/sigecos")(sequelize, Sequelize);

db.users.hasOne(db.sigecos);
db.sigecos.belongsTo(db.users);

sequelize
  .sync({
    alter: true,
  })
  .then(() => {
    console.log("Database & tables updated!");
  });

module.exports = db;
