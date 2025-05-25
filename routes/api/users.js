const express = require("express"),
  db = require("../../sequelize"),
  app = express(),
  crypto = require("crypto"),
  secret = process.env.CONVENE_SECRET,
  nodemailer = require("nodemailer");
const { google } = require('googleapis');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

const oAuth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const sendActivateEmail = async (email, hash) => {
  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.GOOGLE_WORKSPACE_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
    },
  });

  const mailOptions = {
    from: '"XXI Encuentro Regional AIESAD 2025" <encuentroaiesad2025@cuaed.unam.mx>',
    to: email,
    subject: "☑️ Has solicitado validar tu cuenta",
    text: `Hemos recibido una solicitud para activar tu cuenta. Te damos la bienvenida al XXI Encuentro Regional AIESAD 2025. Para comenzar a utilizar tu cuenta, por favor valida tu correo electrónico a través del siguiente enlace: ${process.env.URL_DESTINY}/user/activate/${this.hash}`,
    html: `<div style="font-size: 24px"><p>Hemos recibido una solicitud para activar tu cuenta.</p><p>Te damos la bienvenida al <strong>XXI Encuentro Regional AIESAD 2025</strong>. Para comenzar a utilizar tu cuenta, por favor valida tu correo electrónico a través del siguiente <a href="${process.env.URL_DESTINY}/user/activate/${hash}">enlace</a>.</p></div>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.log("Error to send email messages", error);
    return error;
  }
};

const sendRecoveryEmail = async (email, hash) => {
  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.GOOGLE_WORKSPACE_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
    },
  });

  const mailOptions = {
    from: '"XXI Encuentro Regional AIESAD 2025" <encuentroaiesad2025@cuaed.unam.mx>',
    to: email,
    subject: "🔐 Has solicitado la recuperación de tu contraseña",
    text: `Hemos recibido una solicitud para recuperar tu contraseña, si no has sido tú puedes hacer caso omiso de este correo. No te preocupes que este proceso solo se realiza a través de tu cuenta de correo registrada en nuestra plataforma. Para recuperar tu contraseña, por favor accede al siguiente enlace: ${process.env.URL_DESTINY}/user/setpassword/${hash}`,
    html: `<div style="font-size: 24px"><p>Hemos recibido una solicitud para recuperar tu contraseña, si no has sido tú puedes hacer caso omiso de este correo. No te preocupes que este proceso solo se realiza a través de tu cuenta de correo registrada en nuestra plataforma.</p><p>Para recuperar tu contraseña, por favor accede al siguiente <a href="${process.env.URL_DESTINY}/user/setpassword/${hash}">enlace</a>.</p></div>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.log("Error to send email messages", error);
    return error;
  }
};

const sendConfirmationChangePassword = async (email) => {
  const accessToken = await oAuth2Client.getAccessToken();
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.GOOGLE_WORKSPACE_EMAIL,
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
    },
  });

  const mailOptions = {
    from: '"XXI Encuentro Regional AIESAD 2025" <encuentroaiesad2025@cuaed.unam.mx>',
    to: email,
    subject: "🔑 Has realizado un cambio de tu contraseña",
    text: `Hemos procesado tu cambio de contraseña. Ahora puedes ingresar a la plataforma con tu nueva contraseña.`,
    html: `<div style="font-size: 24px"><p>Hemos procesado tu cambio de contraseña.</p><p>Ahora puedes ingresar a la plataforma con tu nueva contraseña.</p><p>Da clic en el siguiente <a href="${process.env.URL_DESTINY}" target="_blank">enlace</a> para ir a la plataforma.</p></div>`,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Message sent: %s", info.messageId);
    return info;
  } catch (error) {
    console.log("Error to send email messages", error);
    return error;
  }
};

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
                const qrDataForFileName = crypto.createHash('sha256').update(req.body.email).digest('hex');
                const qrContent = qrDataForFileName; 
                const qrCodeFileName = `qr_${qrDataForFileName}.png`;
                
                const baseDir = path.join(__dirname, '..', '..'); 
                const qrCodeDirectory = path.join(baseDir, 'public', 'qrcodes');
                const qrCodeFilePath = path.join(qrCodeDirectory, qrCodeFileName);
                const publicQrCodePath = `/qrcodes/${qrCodeFileName}`; 

                if (!fs.existsSync(qrCodeDirectory)){
                    fs.mkdirSync(qrCodeDirectory, { recursive: true });
                    console.log(`Directorio creado: ${qrCodeDirectory}`);
                }

                qrcode.toFile(qrCodeFilePath, qrContent, { width: 300 }, (err) => {
                  if (err) {
                    console.error('Error generando el código QR:', err);
                  }
                  console.log(`Código QR generado: ${qrCodeFilePath}`);

                  db.users
                    .create({
                      email: req.body.email,
                      password: password,
                      active: false,
                      hash: hash,
                      qrcode: publicQrCodePath, 
                    })
                    .then((newUser) => {
                      db.sigecos
                        .create({
                        userId: newUser.id, 
                        name: req.body.name.toUpperCase(),
                        lastname: req.body.lastname.toUpperCase(),
                        entity: req.body.entity.toUpperCase(),
                        account: req.body.account,
                        curp: req.body.curp.toUpperCase(),
                        studyLevel: req.body.studyLevel,
                        })
                        .then((newSigeco) => { 
                          newUser.sendWelcomeEmail().then((sendMail) => { 
                            if (sendMail.accepted) {
                            res.json({ messageId: sendMail.messageId });
                            } else {
                            res.json({
                              error: "Error al enviar correo electrónico",
                            });
                            }
                          });
                        });
                    })
                    .catch(dbError => { 
                        console.error("Error al crear usuario:", dbError);
                        res.status(500).json({ error: "Error al crear el usuario."});
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

  app.route("/api/users/getactivate").post(function (req, res) {
    const hash = crypto.randomBytes(32).toString("hex");
    db.users
      .update(
        { hash: hash },
        {
          where: {
            email: req.body.email,
            active: 0,
          },
        }
      )
      .then((user) => {
        if (user[0] === 0) {
          res.json({ user: false });
        } else {
          sendActivateEmail(req.body.email, hash).then((sendMail) => {
            res.json({ user: sendMail.messageId });
          });
        }
      });
  });

  app.route("/api/users/recovery").post(function (req, res) {
    const hash = crypto.randomBytes(32).toString("hex");
    db.users
      .update(
        { hash: hash },
        {
          where: {
            email: req.body.email,
          },
        }
      )
      .then((user) => {
        if (user[0] === 0) {
          res.json({ user: false });
        } else {
          sendRecoveryEmail(req.body.email, hash).then((sendMail) => {
            res.json({ user: sendMail.messageId });
          });
        }
      });
  });

  app.route("/api/users/changepassword").post(function (req, res) {
    const newHash = crypto.randomBytes(32).toString("hex");
    const newPassword = crypto
      .createHash("sha256", secret)
      .update(req.body.password)
      .digest("hex");

    db.users
      .update(
        {
          password: newPassword,
          hash: newHash,
        },
        {
          where: {
            hash: req.body.hash,
          },
        }
      )
      .then((user) => {
        if (user[0] === 0) {
          res.json({ newPassword: false });
        } else {
          db.users
            .findOne({
              where: {
                hash: newHash,
                password: newPassword,
              },
            })
            .then((sendUser) => {
              sendConfirmationChangePassword(sendUser.email).then(() => {
                res.json({ newPassword: true });
              });
            });
        }
      });
  });

  app.route("/api/users/signin").post(function (req, res) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Correo electrónico y contraseña son requeridos." });
    }

    const hashedPassword = crypto
      .createHash("sha256", secret)
      .update(password)
      .digest("hex");

    db.users
      .findOne({
        where: {
          email: email,
        },
        include: [{
          model: db.sigecos,
          attributes: ['name', 'lastname', 'entity', 'account', 'curp', 'studyLevel']
        }]
      })
      .then((user) => {
        if (!user) {
          return res
            .status(401)
            .json({ error: "Usuario no encontrado." });
        }

        if (!user.active) {
          return res
            .status(401)
            .json({ error: "Usuario no activo. Por favor, activa tu cuenta." });
        }

        if (user.password !== hashedPassword) {
          return res
            .status(401)
            .json({ error: "Contraseña incorrecta." });
        }

        const userData = {
          id: user.id,
          email: user.email,
          active: user.active,
          userType: user.userType,
          qrcode: user.qrcode,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        };
      
        if (user.sigeco) {
          userData.sigeco = user.sigeco;
        } else if (user.dataValues && user.dataValues.sigeco) { 
          userData.sigeco = user.dataValues.sigeco;
        }

        res.json({
          message: "Inicio de sesión exitoso.",
          user: userData,
        });
      })
      .catch((err) => {
        console.error("Error en signin:", err);
        res.status(500).json({ error: "Error interno del servidor." });
      });
  });

}
