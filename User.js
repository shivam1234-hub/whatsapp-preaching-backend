// const express = require("express");
// const fileUpload = require("express-fileupload");
// const { Client, RemoteAuth } = require("whatsapp-web.js");
// const qrcode = require("qrcode");
// const cors = require("cors");
// const csvParser = require("csv-parser");
// const { MongoStore } = require('wwebjs-mongo');
// const bodyParser = require('body-parser');
// const mongoose = require('mongoose');
// const fs = require("fs");
// const path = require("path");
// const { GridFSBucket } = require("mongodb");
// const User = require('./User');
// const SessionStore = require('./SessionStore');
// const {
//     Server
// } = require('socket.io');
// const http = require('http');
// const app = express();
// const server = http.createServer(app);
//
// require('dotenv').config();
//
// app.use(cors());
// app.use(express.json());
// app.use(fileUpload());
//
// let store;
// const io = new Server(server, {
//     cors: {
//         origin: '*',
//         methods: ['GET', 'POST']
//     },
// })
// app.use(bodyParser.json());
// mongoose.connect(process.env.MONGO_URI).then(() => {
//     console.log('Connected to database');
//     store = new MongoStore({
//         mongoose: mongoose
//     });
// });
//
// app.listen(4000, () => {
//     console.log('API server started on port ');
// });
// server.listen(3001, () => {
//     console.log('Socket server started on port ');
// });
//
//
// const allsessions = {};
//
// // Ensure the uploads directory exists
// const uploadDir = "./uploads";
// if (!fs.existsSync(uploadDir)) {
//     fs.mkdirSync(uploadDir, { recursive: true });
// }
//
// const createWhatsappSession = async (id, socket) => {
//     const client = new Client({
//         puppeteer: {
//             headless: true,
//         },
//         authStrategy: new RemoteAuth({
//             clientId: id,
//             store: store,
//             backupSyncIntervalMs: 300000
//         })
//     });
//     client.on('qr', (qr) => {
//         socket.emit('qr', {
//             qr
//         });
//     });
//     client.on('authenticated', (session) => {
//         console.log('AUTHENTICATED:::', session);
//     })
//     client.on('ready', async () => {
//         console.log('READY--1');
//         allsessions[id] = client;
//         socket.emit('ready', {
//             id,
//             message: 'client is ready'
//         });
//     });
//     client.on('remote_session_saved', () => {
//         console.log('remote-session saved');
//         socket.emit('remote_session_saved', {
//             message: 'remote session saved'
//         });
//     })
//     client.initialize();
// }
//
// const getWhatsappSession = async (id, socket) => {
//     const client = new Client({
//         puppeteer: {
//             headless: false,
//         },
//         authStrategy: new RemoteAuth({
//             clientId: id,
//             store: store,
//             backupSyncIntervalMs: 300000
//         })
//     });
//     client.initialize();
// }
//
//
// io.on('connection', (socket) => {
//     socket.on('disconnect', () => {
//         console.log('user disconnected');
//     });
//     socket.on('getsession', (data) => {
//         console.log('getsession', data);
//         var obj = JSON.parse(data)
//         const {
//             id
//         } = obj.uuid;
//         getWhatsappSession(id, socket);
//     });
//     socket.on('connected', (data) => {
//         console.log('connected to the server', data);
//         socket.emit('hello', 'hello from the server');
//     });
//     socket.on('createSession', (data) => {
//         console.log('creating session for a user', data);
//         var obj = JSON.parse(data)
//         const {
//             id
//         } = obj.uuid;
//         createWhatsappSession(id, socket)
//             .then(() => {
//                 const successMessage = "Session created successfully";
//                 socket.emit('sessionCreated', {
//                     message: successMessage
//                 });
//             })
//             .catch((error) => {
//                 const errorMessage = "Failed to create session";
//                 socket.emit('sessionCreationFailed', {
//                     message: errorMessage
//                 });
//             });
//     });
// });
//
//
//

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    clientId: { type: String, unique: true, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
});

module.exports = mongoose.model('User', userSchema);
