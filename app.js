const express = require('express');
const bodyParser = require('body-parser');

const itemsRoutes = require('./routes/items-routes');
const loginRoute = require('./routes/login-route');
const HttpError = require('./util/http-error');


const app = express();

app.use(bodyParser.json());

app.use(express.static('images'));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers',
        'Origin, X-Requested-With, content-type, Accept, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
    next();
});

app.use('/api/login', loginRoute);
app.use('/api/item', itemsRoutes);

app.use((req, res, next) => {
    throw new HttpError('Could not find this route', 404);
});

app.use((error, req, res, next) => {
    res.status(error.code || 500);
    res.json({ message: error.message || 'An unknown error occurred!' });
});

const server = app.listen(process.env.PORT || 5000);
const io = require('./socket').init(server);
io.on('connection', socket => {
    // console.log('Client connected');
    socket.on('disconnect', () => {
        // console.log('CLient disconnected')
    })
})

