const express = require('express'),
    dotenv = require('dotenv').config(),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    app = express();

app.use(bodyParser.json())
app.use(cors())
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(express.static('public'));

app.get('/', (req, res) => {
    res.send('Welcome to Convence Flow API');
});

require('./routes/api/users')(app);

const PORT = process.env.PORT || 6600;
app.listen(PORT);
