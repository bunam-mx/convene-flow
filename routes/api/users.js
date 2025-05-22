const express = require("express"),
  db = require("../../sequelize"),
  app = express(),
  crypto = require("crypto"),
  secret = process.env.CONVENE_SECRET;

module.exports = (app) => {
  app.route("/api/users/").get(function (req, res) {
    db.users
      .findAll({
        attributes: ['email', 'active', 'userType', 'createdAt', 'updatedAt'],
        where: {
          active: true,
        },
      })
      .then((users) => {
        res.json(users);
      });
  });

  app.route("/api/users/:id").get(function (req, res) {
    db.users
      .findAll({
        attributes: ['email', 'active', 'userType', 'createdAt', 'updatedAt'],
        where: {
          id: req.params.id,
        },
      })
      .then((user) => {
        res.json(user);
      });
  });

  app.route("/api/users/signup").post(function (req, res) {
    const hash = crypto
      .createHash("sha256", secret)
      .update(req.body.email + req.body.password)
      .digest("hex");
    const password = crypto
      .createHash("sha256", secret)
      .update(req.body.password)
      .digest("hex");
    db.users
      .findAll({
        where: {
          email: req.body.email,
        },
      })
      .then((user) => {
        if (user.length > 0) {
          res.json({
            error: "El correo electrónico ya se encuentra registrado",
          });
        } else {
          db.sigecos
            .findAll({
              where: {
                curp: req.body.curp,
              },
            })
            .then((sigeco) => {
              if (sigeco.length > 0) {
                res.json({ error: "El CURP ya se encuentra registrado" });
              } else {
                db.users
                  .create({
                    email: req.body.email,
                    password: password,
                    active: false,
                    hash: hash,
                  })
                  .then((user) => {
                    db.sigecos
                      .create({
                      userId: user.id,
                      name: req.body.name.toUpperCase(),
                      lastname: req.body.lastname.toUpperCase(),
                      entity: req.body.entity.toUpperCase(),
                      account: req.body.account,
                      curp: req.body.curp.toUpperCase(),
                      studyLevel: req.body.studyLevel,
                      })
                      .then((sigeco) => {
                      user.sendWelcomeEmail().then((sendMail) => {
                        if (sendMail.accepted) {
                        res.json({ messageId: sendMail.messageId });
                        } else {
                        res.json({
                          error: "Error al enviar correo electrónico",
                        });
                        }
                      });
                      });
                  });
              }
            });
        }
      });
  });

  app.route("/api/users/activate").post(function (req, res) {
    const newHash = crypto.randomBytes(32).toString("hex");
    db.users
      .update(
        { active: 1, hash: newHash },
        {
          where: {
            hash: req.body.hash,
          },
        }
      )
      .then((user) => {
        if (user[0] === 0) {
          res.json({ user: false });
        } else {
          res.json({ user: true });
        }
      });
  });

}
