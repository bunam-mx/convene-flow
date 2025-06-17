const express = require('express'),
    dotenv = require('dotenv').config(),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    session = require('express-session'),
    app = express();

app.use(session({
  secret: process.env.CONVENE_SECRET || 'your-secret-key', // Cambia esto por una clave segura
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Cambia a true si usas HTTPS
}));

app.use(bodyParser.json());
app.use(cors());
app.set("view engine", "pug");
app.use("/static", express.static('assets'));
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.static('public'));

const statisticsMiddleware = require("./middlewares/convene-flow");
app.use('/cf/dashboard/', statisticsMiddleware);

require('./routes/dashboard')(app);

require('./routes/api/users')(app);
require('./routes/api/sigecos')(app);
require('./routes/api/proposals')(app);
require('./routes/api/thematicLines')(app);

const PORT = process.env.PORT || 6600;
app.listen(PORT);
