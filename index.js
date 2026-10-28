const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const readline = require('readline');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let botStatus = 'Terminal par number enter karein...';
let pairingCodeText = 'Waiting...';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Puppeteer & Timeout Optimization for Node v24
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        timeout: 90000, // 90 Seconds timeout taake script crash na ho
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    }
});

// Pairing code setup
client.on('qr', async () => {
    rl.question('Apna WhatsApp Number Country Code ke sath likhein (Misal: 923001234567): ', async (phoneNumber) => {
        phoneNumber = phoneNumber.trim();
        try {
            botStatus = 'Generating pairing code...';
            const code = await client.requestPairingCode(phoneNumber);
            pairingCodeText = code;
            botStatus = 'Pairing Code Ready! 🔑';
            console.log(`\n========================================`);
            console.log(` 🔑 PAIRING CODE: ${code} `);
            console.log(`========================================\n`);
        } catch (err) {
            console.error('Pairing error:', err);
            botStatus = 'Error generating code';
        }
    });
});

// Bot Link hone par Welcome Message Self-Chat mein bhejna
client.on('ready', async () => {
    botStatus = 'Connected & Active 🚀';
    pairingCodeText = 'Linked Successfully ✅';
    console.log('✨ Mahnoor-MD Bot kamyabi se active ho gaya hai!');

    try {
        const botNumber = client.info.wid._serialized;
        const now = new Date();
        const options = { timeZone: 'Asia/Karachi', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
        const dateTimeString = now.toLocaleString('en-GB', options);

        let connectMsg = `╭━━━「 *MAHNOOR-MD* 」━━━╮\n`;
        connectMsg += `┃ 🚀 Status: *Connected Successfully!*\n`;
        connectMsg += `┃ 👑 Owner: *Mahnoor Mateen*\n`;
        connectMsg += `┃ ⏰ Time: *${dateTimeString}*\n`;
        connectMsg += `╰━━━━━━━━━━━━━━━━━━╯\n\n`;
        connectMsg += `_Mahnoor-MD WhatsApp Bot is now active on your chat!_`;

        try {
            const media = MessageMedia.fromFilePath('./logo.jpg');
            await client.sendMessage(botNumber, media, { caption: connectMsg });
        } catch (err) {
            await client.sendMessage(botNumber, connectMsg);
        }
    } catch (e) {
        console.error('Connected message error:', e);
    }
});

// Web Dashboard Socket updates
io.on('connection', (socket) => {
    socket.emit('update', { status: botStatus, code: pairingCodeText });
});

setInterval(() => {
    io.emit('update', { status: botStatus, code: pairingCodeText });
}, 1000);

// Shared Command Handler Logic
const processCommand = async (msg) => {
    try {
        if (!msg.body) return;
        const text = msg.body.trim().toLowerCase();
        const ownerName = "Mahnoor Mateen MD";

        console.log(`📥 Command detected: "${text}" | fromMe: ${msg.fromMe}`);

        // 1. .menu Command
        if (text === '.menu' || text === '.help') {
            const menuText = `╭━━━「 *${ownerName}* 」━━━╮\n` +
                             `┃ 👑 Owner: Mahnoor Mateen\n` +
                             `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
                             `📂 *Commands:*\n` +
                             `• .menu (Show Menu)\n` +
                             `• .vv (Save View-Once / Quoted Media)\n` +
                             `• .ban (Fake Ban Message)`;
            await msg.reply(menuText);
        } 
        // 2. .vv Command
        else if (text === '.vv') {
            if (msg.hasQuotedMsg) {
                const quoted = await msg.getQuotedMessage();
                if (quoted.hasMedia) {
                    const media = await quoted.downloadMedia();
                    await client.sendMessage(msg.from, media, { caption: `✅ Saved by ${ownerName}` });
                } else {
                    await msg.reply('❌ Quoted message mein koi media (photo/video) nahi hai.');
                }
            } else {
                await msg.reply('⚠️ Kisi media message par reply karke .vv likhein.');
            }
        } 
        // 3. .ban Command
        else if (text === '.ban') {
            await msg.reply('⚠️ *Your WhatsApp is banned now!*');
        }
    } catch (error) {
        console.error('Command Execution Error:', error);
    }
};

// Listen to incoming messages from other contacts
client.on('message', async (msg) => {
    if (!msg.fromMe) {
        await processCommand(msg);
    }
});

// LISTEN TO SELF MESSAGES (Apne number par command chalane ke liye)
client.on('message_create', async (msg) => {
    if (msg.fromMe && msg.body && msg.body.startsWith('.')) {
        await processCommand(msg);
    }
});

client.initialize();

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web Dashboard live at: http://localhost:${PORT}`);
});