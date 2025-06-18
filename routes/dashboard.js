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

        req.session.email = user.email;
        req.session.userType = user.userType;
        req.session.userId = user.id;
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

  app.get("/cf/dashboard/proposals", async (req, res) => {
    try {
      const proposalsData = await db.proposals.findAll({
        attributes: ["id", "title", "state", "editable"],
        include: [
          {
            model: db.thematicLines,
            as: "thematicLine",
            attributes: ["thematicLine"],
            required: true,
          },
          {
            model: db.users,
            as: "authors",
            attributes: ["id"],
            include: [
              {
                model: db.sigecos,
                attributes: ["name", "lastname"],
                required: true,
              },
            ],
            through: {
              attributes: [],
            },
          },
        ],
      });
      console.log("Proposals Data:", proposalsData);
      res.render("proposals", { proposalsData });
    } catch (err) {
      console.error("Error fetching proposals data:", err);
      res.status(500).send("Error interno del servidor");
    }
  });

  app.get("/cf/dashboard/reviewers", async (req, res) => {
    try {
      const reviewers = await db.users.findAll({
        where: { userType: "review" },
        attributes: ["id"],
        include: [{
          model: db.sigecos,
          attributes: ["name", "lastname"],
          required: true
        }]
      });
      res.status(200).json(reviewers);
    } catch (err) {
      console.error("Error fetching reviewers:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/cf/dashboard/proposals/:id/assign-reviewer", async (req, res) => {
    try {
      const proposalId = req.params.id;
      const { reviewerId } = req.body;

      if (!reviewerId) {
        return res.status(400).json({ error: "Reviewer ID is required." });
      }

      const proposal = await db.proposals.findByPk(proposalId);
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found." });
      }

      await proposal.setReviewers([reviewerId]);

      res.status(200).json({ message: "Reviewer assigned successfully." });

    } catch (err) {
      console.error("Error assigning reviewer:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/cf/dashboard/proposals/:id/update-state", async (req, res) => {
    try {
      const proposalId = req.params.id;
      const { state } = req.body;

      if (!state) {
        return res.status(400).json({ message: "State is required." });
      }

      const proposal = await db.proposals.findByPk(proposalId);
      if (!proposal) {
        return res.status(404).json({ message: "Proposal not found." });
      }

      // Si el cambio es de 'En proceso' a 'Enviado', editable = 0
      let updateFields = { state };
      if (proposal.state === 'En proceso' && state === 'Enviado') {
        updateFields.editable = 0;
      }

      await proposal.update(updateFields);

      res.status(200).json({ message: "Proposal state updated successfully." });
    } catch (err) {
      console.error("Error updating proposal state:", err);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/cf/dashboard/proposals/:id", async (req, res) => {
    try {
      const proposalId = req.params.id;
      const proposalData = await db.proposals.findOne({
        where: { id: proposalId },
        attributes: ["id", "proposal", "state"],
        include: [{
          model: db.users,
          as: 'reviewers',
          attributes: ['id'],
          through: { attributes: [] }
        }]
      });

      if (!proposalData) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      res.status(200).json(proposalData);
    } catch (err) {
      console.error("Error fetching proposal details:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/cf/dashboard/my-reviews", async (req, res) => {
    try {
      const reviewerId = req.session.userId;
      if (!reviewerId) {
        return res.status(401).send("Unauthorized");
      }
      const proposalsData = await db.proposals.findAll({
        attributes: ["id", "title", "state", "editable"],
        include: [
          {
            model: db.thematicLines,
            as: "thematicLine",
            attributes: ["thematicLine"],
            required: true,
          },
          {
            model: db.users,
            as: "reviewers",
            attributes: [],
            where: { id: reviewerId },
            through: { attributes: [] },
            required: true
          }
        ],
      });
      res.render("my-reviews", { proposalsData });
    } catch (err) {
      console.error("Error fetching my reviews:", err);
      res.status(500).send("Error interno del servidor");
    }
  });

  app.post("/cf/dashboard/proposals/:id/review-comment", async (req, res) => {
    try {
      const proposalId = req.params.id;
      const { state, comment } = req.body;
      const userId = req.session.userId;
      if (!userId) return res.status(401).json({ message: "No autorizado" });
      if (!comment) return res.status(400).json({ message: "El comentario es obligatorio." });
      // Guardar comentario en proposalHistories
      await db.proposalHistories.create({
        comment,
        userId,
        proposalId
      });
      // Actualizar estado de la propuesta
      if (state) {
        await db.proposals.update({ state }, { where: { id: proposalId } });
      }
      res.status(200).json({ message: "Comentario guardado correctamente." });
    } catch (err) {
      console.error("Error guardando comentario de revisión:", err);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });

  app.get("/cf/dashboard/proposals/:id/comments", async (req, res) => {
    try {
      const proposalId = req.params.id;
      const histories = await db.proposalHistories.findAll({
        where: { proposalId },
        order: [["createdAt", "DESC"]],
        include: [{
          model: db.users,
          attributes: ["id"],
          include: [{
            model: db.sigecos,
            as: 'sigeco',
            attributes: ["name", "lastname"]
          }]
        }]
      });
      const result = histories.map(h => ({
        comment: h.comment,
        createdAt: h.createdAt,
        userName: h.user && h.user.sigeco ? `${h.user.sigeco.name} ${h.user.sigeco.lastname}` : undefined
      }));
      res.json(result);
    } catch (err) {
      console.error("Error fetching proposal comments:", err);
      res.status(500).json([]);
    }
  });

  app.get("/cf/dashboard/reviewers-list", async (req, res) => {
    try {
      const reviewers = await db.users.findAll({
        where: { userType: "review" },
        attributes: ["id", "email"],
        include: [
          {
            model: db.sigecos,
            as: 'sigeco',
            attributes: ["name", "lastname"]
          },
          {
            model: db.proposals,
            as: "reviewProposals",
            attributes: ["id", "title", "state"],
            through: { attributes: [] }
          }
        ]
      });
      res.render("reviewers-list", { reviewers });
    } catch (err) {
      console.error("Error fetching reviewers list:", err);
      res.status(500).send("Error interno del servidor");
    }
  });

  
};
