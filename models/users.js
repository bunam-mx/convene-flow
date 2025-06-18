require('dotenv').config();
const nodemailer = require("nodemailer");
const { google } = require('googleapis');

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

module.exports = (sequelize, type) => {
  const Users = sequelize.define("users", {
    id: {
      type: type.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    email: type.STRING,
    password: type.STRING,
    active: {
      type: type.BOOLEAN,
      defaultValue: false,
    },
    userType: {
      type: type.ENUM("admin", "staff", "review", "speaker", "user"),
      defaultValue: "user",
    },
    hash: type.STRING,
    qrcode: type.STRING,
    attendanceMode: {
      type: type.ENUM('Presencial', 'Virtual'),
      allowNull: false,
      defaultValue: 'Presencial',
    },
  });

  Users.prototype.sendWelcomeEmail = async function () {
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
      to: this.email,
      subject: "✅ Comencemos validando tu cuenta",
      text: `Le damos la más cordial bienvenida al XXI Encuentro Regional AIESAD 2025. Para comenzar a utilizar su cuenta, por favor valide su correo electrónico a través del siguiente enlace: ${process.env.URL_DESTINY}/user/activate/${this.hash} Este correo fue enviado automáticamente, por favor no lo responda.`,
      html: `<div style="font-size: 24px"><p>Le damos la más cordial bienvenida al <strong>XXI Encuentro Regional AIESAD 2025</strong>.</p><p>Para comenzar a utilizar su cuenta, por favor valide su correo electrónico a través del siguiente <a href="${process.env.URL_DESTINY}/user/activate/${this.hash}">enlace</a>.</p><p>Este correo fue enviado automáticamente, por favor no lo responda.</p><p>Para dudas comuníquese al correo <a href="mailto:encuentroaiesad2025@cuaed.unam.mx">encuentroaiesad2025@cuaed.unam.mx</a></p></div>`,
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

  // Definir asociaciones después de que todos los modelos estén disponibles
  Users.associate = (models) => {
    // Relación uno a uno con Sigecos
    Users.hasOne(models.sigecos, { foreignKey: 'userId' }); 

    // Relación muchos a muchos con Proposals
    Users.belongsToMany(models.proposals, {
      through: 'userProposals', // Mismo nombre de tabla de unión
      foreignKey: 'userId',
      otherKey: 'proposalId',
      timestamps: false
    });

    // Relación muchos a muchos con Proposals (como revisor)
    Users.belongsToMany(models.proposals, {
      through: 'reviewerProposals',
      as: 'reviewProposals',
      foreignKey: 'userId',
      otherKey: 'proposalId',
      timestamps: false
    });
  };

  return Users;
};
