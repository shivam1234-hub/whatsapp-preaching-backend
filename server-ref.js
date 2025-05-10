const express = require('express');
const app = express();
const fs = require('fs');
const bodyParser = require('body-parser');
const {
    Client,
    RemoteAuth,
    MessageMedia,
    LegacySessionAuth
} = require('whatsapp-web.js');
const {
    MongoStore
} = require('wwebjs-mongo');
const mongoose = require('mongoose');
const {
    Server
} = require('socket.io');
const http = require('http');
const cors = require('cors')
const server = http.createServer(app);
app.use(cors())
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
let store;
const MONGODB_URI = 'mongodb://127.0.0.1:27017/test';
const io = new Server(server, {
    cors: {
        origin: '',
        methods: ['GET', 'POST']
    },
})
app.use(bodyParser.json());
mongoose.connect(MONGODB_URI).then(() => {
    console.log('Connected to database');
    store = new MongoStore({
        mongoose: mongoose
    });
});

app.listen(4000, () => {
    console.log('API server started on port ');
});
server.listen(3001, () => {
    console.log('Socket server started on port ');
});
const allsessions = {};
const createWhatsappSession = async (id, socket) => {
    const client = new Client({
        puppeteer: {
            headless: true,
        },
        authStrategy: new RemoteAuth({
            clientId: id,
            store: store,
            backupSyncIntervalMs: 300000
        })
    });
    client.on('qr', (qr) => {
        socket.emit('qr', {
            qr
        });
    });
    client.on('authenticated', (session) => {
        console.log('AUTHENTICATED:::', session);
    })
    client.on('ready', () => {
        console.log('READY--1');
        allsessions[id] = client;
        socket.emit('ready', {
            id,
            message: 'client is ready'
        });
    });
    client.on('remote_session_saved', () => {
        console.log('remote-session saved');
        socket.emit('remote_session_saved', {
            message: 'remote session saved'
        });
    })
    client.initialize();
}

const getWhatsappSession = async (id, socket) => {
    const client = new Client({
        puppeteer: {
            headless: false,
        },
        authStrategy: new RemoteAuth({
            clientId: id,
            store: store,
            backupSyncIntervalMs: 300000
        })
    });
    client.initialize();
}

io.on('connection', (socket) => {
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    socket.on('getsession', (data) => {
        console.log('getsession', data);
        var obj = JSON.parse(data)
        const {
            id
        } = obj.uuid;
        getWhatsappSession(id, socket);
    });
    socket.on('connected', (data) => {
        console.log('connected to the server', data);
        socket.emit('hello', 'hello from the server');
    });
    socket.on('createSession', (data) => {
        console.log('creating session for a user', data);
        var obj = JSON.parse(data)
        const {
            id
        } = obj.uuid;
        createWhatsappSession(id, socket)
            .then(() => {
                const successMessage = "Session created successfully";
                socket.emit('sessionCreated', {
                    message: successMessage
                });
            })
            .catch((error) => {
                const errorMessage = "Failed to create session";
                socket.emit('sessionCreationFailed', {
                    message: errorMessage
                });
            });
    });
});
`