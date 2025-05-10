const express = require("express");
const fileUpload = require("express-fileupload");
const { Client, RemoteAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const cors = require("cors");
const csvParser = require("csv-parser");
const { MongoStore } = require('wwebjs-mongo');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const fs = require("fs");
const path = require("path");
const { GridFSBucket } = require("mongodb");
const User = require('./User');
const SessionStore = require('./SessionStore');
const {
    Server
} = require('socket.io');
const http = require('http');
const app = express();
const server = http.createServer(app);

require('dotenv').config();

app.use(cors());
app.use(express.json());
app.use(fileUpload());

const activeClients = new Map();

let store;
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    },
})
app.use(bodyParser.json());
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log('Connected to database');
    store = new MongoStore({
        mongoose: mongoose
    });
});

app.listen(4001, () => {
    console.log('API server started on port ');
});
server.listen(3002, () => {
    console.log('Socket server started on port ');
});

const userSchema = new mongoose.Schema({
    clientId: { type: String, unique: true, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
});




// Ensure the uploads directory exists
const uploadDir = "./uploads";
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

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
    client.on('ready', async () => {
        console.log('READY--1');
    });
    client.on('remote_session_saved', async () => {
        console.log('remote-session saved');
        activeClients.set(id, { client, ready: true });
        await User.findOneAndUpdate(
            { clientId: id },
            { $setOnInsert: { createdAt: new Date(), status: 'active' } },
            { upsert: true, new: true }
        );
        socket.emit('ready', {
            id,
            message: 'client is ready'
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

const getClientForId = (id) => {
    return new Client({
        puppeteer: { headless: true },
        authStrategy: new RemoteAuth({
            clientId: id,
            store: store,
            backupSyncIntervalMs: 300000
        }),
    });
};


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
    socket.on('createSession', async(data) => {

        console.log('creating session for a user', data);
        var obj = JSON.parse(data)
        const {
            id
        } = obj.uuid;

        // Check if client is already in memory
        if (activeClients.has(id)) {
            console.log(`Client ${id} already active in memory`);
            socket.emit('session_exists', {
                id,
                message: 'Session already active'
            });
            return;
        }

        // Check if session exists in DB via User model
        const existingUser = await User.findOne({ clientId: id });

        if (existingUser) {
            console.log(`Restoring session for ${id} from MongoDB`);
            // Restore and initialize WhatsApp session from DB
            await createWhatsappSession(id, socket);
            socket.emit('session_restored', {
                id,
                message: 'Session restored successfully'
            });
            return;
        }


        if (existingUser) {
            console.log(`Session for ${id} already exists in MongoDB`);
            socket.emit('session_exists', {
                id,
                message: 'Session already exists, reusing it'
            });
            return;
        }

        console.log(`No session found for ${id}, creating new`)

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

    socket.on('send_message', async (data) => {
        try {
            const { id, number, message } = JSON.parse(data);

            const entry = activeClients.get(id);

            if (!entry || !entry.ready) {
                socket.emit('message_error', {
                    message: 'Client not initialized or not ready'
                });
                return;
            }

            const client = entry.client;

            // WhatsApp numbers must end with '@c.us'
            const chatId = number.includes('@c.us') ? number : `${number}@c.us`;

            await client.sendMessage(chatId, message);
            socket.emit('message_sent', {
                number,
                message,
                status: 'sent'
            });
        } catch (err) {
            console.error('Error sending message:', err);
            socket.emit('message_error', {
                message: 'Failed to send message',
                error: err.toString()
            });
        }
    });

});



