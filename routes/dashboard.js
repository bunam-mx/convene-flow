const express = require("express"),
  db = require("../sequelize"),
  crypto = require("crypto"),
  secret = process.env.CONVENE_SECRET,
  app = express();

module.exports = (app) => {
  app
    .route("/cf/")
    .get(function (req, res) {
      let responseMessage = { status: "", message: "", user: null };
      res.render("login", { responseMessage });
    })
    .post(async function (req, res) {
      const { email, password } = req.body;
      let responseMessage = { status: "", message: "", user: null };

      if (!email || !password) {
        responseMessage.status = "error";
        responseMessage.message =
          "Correo electrónico y contraseña son requeridos.";
        return res.render("login", { responseMessage });
      }

      try {
        const hashedPassword = crypto
          .createHash("sha256", secret)
          .update(password)
          .digest("hex");

        const user = await db.users.findOne({
          where: {
        email,
        password: hashedPassword,
        userType: ["admin", "staff", "review"],
        active: true,
          },
        });

        if (!user) {
          responseMessage.status = "error";
          responseMessage.message = "Usuario no encontrado.";
          return res.render("login", { responseMessage });
        }

        req.session.email = user.email; // Store the user email in session
        res.redirect("/cf/dashboard/home");
      } catch (err) {
        console.error("Error en signin:", err);
        responseMessage.status = "error";
        responseMessage.message = "Error interno del servidor.";
        res.render("login", { responseMessage });
      }
    });

  app.route("/cf/dashboard/home").get(async function (req, res) {
    try {
      const registeredUsers = await db.users.count();
      const activeUsers = await db.users.count({ where: { active: true } });
      const proposalsByStateRaw = await db.proposals.findAll({
        attributes: ["state", [db.Sequelize.fn("COUNT", db.Sequelize.col("state")), "count"]],
        group: ["state"],
      });

      const proposalsByState = proposalsByStateRaw.map((proposal) => ({
        state: proposal.state,
        count: parseInt(proposal.dataValues.count, 10),
      }));

      const data = {
        registeredUsers,
        activeUsers,
        proposalsByState,
      };

      res.render("home", { data });
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      res.status(500).send("Error interno del servidor");
    }
  });

  app.route("/cf/dashboard/users").get(async function (req, res) {
    try {
      const usersData = await db.users.findAll({
        attributes: ["id", "email", "active"],
        where: { userType: "user" },
        include: [
          {
            model: db.sigecos,
            attributes: ["name", "lastname", "entity"],
            required: true,
          },
        ],
      });
      res.render("users", { usersData });
    } catch (err) {
      console.error("Error fetching users data:", err);
      res.status(500).send("Error interno del servidor");
    }
  });

  app.get("/cf/dashboard/statistics", (req, res) => {
    res.render("statistics", { user: req.session.user });
  });

  app.get("/cf/dashboard/flow", (req, res) => {
    res.render("flow", { user: req.session.user });
  });

  app.route("/cf/dashboard/users/:id").post(async function (req, res) {
    try {
      const id = req.params.id;

      const {
        email,
        active,
        userType,
        attendanceMode,
        name,
        lastname,
        entity,
        curp,
        studyLevel,
      } = req.body;

      // Validar que ninguno de los campos esté vacío
      const requiredFields = [
        "email",
        "userType",
        "attendanceMode",
        "name",
        "lastname",
        "entity",
        "curp",
        "studyLevel",
      ];

      for (const field of requiredFields) {
        if (!req.body[field]) {
          console.error(`Missing field: ${field}`);
          return res.status(400).json({ error: `Field '${field}' is required` });
        }
      }

      // Actualizar la tabla users
      await db.users.update(
        { email, active, userType, attendanceMode },
        { where: { id } }
      );

      // Actualizar la tabla sigecos
      await db.sigecos.update(
        { name, lastname, entity, curp, studyLevel },
        { where: { userId: id } }
      );

      res.status(200).json({ message: "User updated successfully" });
    } catch (err) {
      console.error("Error updating user data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  })
  .get(async function (req, res) {
    try {
      const id = req.params.id;

      const userData = await db.users.findOne({
        attributes: ["id", "email", "active", "userType", "attendanceMode"],
        where: { id },
        include: [
          {
            model: db.sigecos,
            attributes: ["name", "lastname", "entity", "curp", "studyLevel"],
            required: true,
          },
        ],
      });

      if (!userData) {
        return res.status(404).json({ error: "User not found" });
      }

      res.status(200).json(userData);
    } catch (err) {
      console.error("Error fetching user data:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
};
