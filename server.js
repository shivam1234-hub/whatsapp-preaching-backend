// /api/whatsapp.js

const express = require("express");
const fileUpload = require("express-fileupload");
const { Client, RemoteAuth } = require("whatsapp-web.js");
const mongoose = require("mongoose");
const { MongoStore } = require("wwebjs-mongo");
const User = require('./User');
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

// Create Express app and server
const app = express();

require('dotenv').config();

// Setup MongoDB store
const store = new MongoStore({
    mongoose: mongoose,
});

const args =  [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-accelerated-2d-canvas',
    '--no-first-run',
    '--no-zygote',
    '--disable-gpu',
    '--disable-extensions',
    '--disable-software-rasterizer',
    '--disable-features=site-per-process',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process'
]


const corsOptions = {
    origin: '*', // Or use specific origin: ["https://your-frontend-domain.com"]
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};

app.use(cors(corsOptions));

app.use(express.json());
app.use(fileUpload());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI).then(() => {
    console.log("Connected to database");
});

// Define schema
const userSchema = new mongoose.Schema({
    clientId: { type: String, unique: true, required: true },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
});

const sessionPath = '/tmp/sessions';
if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath, { recursive: true });
}

    
// Create session API
app.post("/api/create-session", async (req, res) => {
    const { id } = req.body;
    
    console.log("Creating session for ID:", id);

    try {
        const existingUser = await User.findOne({ clientId: id });

        if (existingUser) {
            return res.status(200).json({ message: "Session restored successfully" });
        }

        const client = new Client({
            puppeteer: {
                executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
                args: args
            },
            authStrategy: new RemoteAuth({
                clientId: id,
                store: store,
                backupSyncIntervalMs: 300000,
                dataPath: '/tmp/sessions'
            }),
        });

        client.on("qr", (qr) => {
            if (!res.headersSent) { // Check if headers are already sent
                res.status(200).json({ qr });
            }
        });

        client.on("authenticated", (session) => {
            console.log("Authenticated:", session);
        });

        client.on("ready", async () => {
            activeClients.set(id, { client, ready: true });
            console.log("WhatsApp client is ready!");
        });

        client.on('remote_session_saved', async () => {
            console.log('remote-session saved');

            await User.findOneAndUpdate(
                { clientId: id },
                { $setOnInsert: { createdAt: new Date(), status: 'active' } },
                { upsert: true, new: true }
            );
        })

        await client.initialize();
        // Only respond if session was created successfully
        if (!res.headersSent) {
            res.status(200).json({ message: "Session created" });
        }
    } catch (error) {
        console.error("Error creating session:", error);
        res.status(500).json({ error: "Failed to create session", details: error });
    }
});

// Send message API
app.post("/api/send-message", async (req, res) => {
    const { id, number, message } = req.body;

    try {
        const entry = await getClientForId(id);

        if (!entry || !entry.ready) {
            return res.status(400).json({ error: "Client not initialized or not ready" });
        }
        
        const client = entry.client;

        const chatId = number.includes("@c.us") ? number : `${number}@c.us`;

        await client.sendMessage(chatId, message);
        res.status(200).json({ status: "sent", number, message });
    } catch (err) {
        console.error("Error sending message:", err);
        res.status(500).json({ error: "Failed to send message", details: err });
    }
});



// Helper to get client by id (storing in-memory or DB)
const activeClients = new Map();

const getClientForId = async (id) => {
    let client = activeClients.get(id);

    if (!client) {
        // Fetch from DB and initialize if not in memory
        const existingUser = await User.findOne({ clientId: id });

        if (existingUser) {
            client = new Client({
                puppeteer: {
                    executablePath: process.env.NODE_ENV === 'production' ? process.env.PUPPETEER_EXECUTABLE_PATH : puppeteer.executablePath(),
                    args: args,
                },
                authStrategy: new RemoteAuth({
                    clientId: id,
                    store: store,
                    backupSyncIntervalMs: 300000,
                    dataPath: '/tmp/sessions'
                }),
            });
            await client.initialize();
            activeClients.set(id, client);
        }
    }

    return client;
};

app.listen(5000, () => {
    console.log("API server started on port 4001");
});

