const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Statikus fájlok kiszolgálása a jelenlegi mappából
app.use(express.static(__dirname));

// MongoDB kapcsolat
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://20080511b_db_user:838rxtlriaTT7YP0@cluster0.eaz4wu5.mongodb.net/otvenmilli?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => {
    console.log("Sikeresen csatlakozott a MongoDB-hez!");
}).catch(err => {
    console.error("Hiba a MongoDB csatlakozáskor! Kérlek ellenőrizd a MONGO_URI-t. Hiba:", err.message);
});

// Üzenet séma és modell
const MessageSchema = new mongoose.Schema({
    id: String,
    name: String,
    text: String,
    time: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message50M', MessageSchema); // Külön kollekció ebbe a játékba

let isChatEnabled = false;

io.on('connection', async (socket) => {
    console.log('Egy felhasználó csatlakozott:', socket.id);

    // Amikor egy felhasználó csatlakozik, elküldjük neki az eddigi üzeneteket
    try {
        const messages = await Message.find().sort({ timestamp: 1 }).limit(100);
        socket.emit('init_messages', messages);
    } catch (err) {
        console.error('Hiba az üzenetek lekérdezésekor:', err);
    }

    if (isChatEnabled) {
        socket.emit('chat_enabled');
    }

    socket.on('request_help', () => {
        isChatEnabled = true;
        io.emit('chat_enabled');
    });

    socket.on('reset_chat', async () => {
        // Opció: törli az összes üzenetet az adatbázisból (vagy csak a memóriából)
        try {
            await Message.deleteMany({});
            io.emit('chat_reset');
        } catch (err) {
            console.error('Hiba az üzenetek törlésekor:', err);
        }
    });

    socket.on('send_message', async (data) => {
        try {
            // Elmentjük az adatbázisba
            const newMsg = new Message({
                id: data.id,
                name: data.name,
                text: data.text,
                time: data.time
            });
            await newMsg.save();

            // Kiküldjük mindenkinek
            io.emit('receive_message', newMsg);
        } catch (err) {
            console.error('Hiba az üzenet mentésekor:', err);
        }
    });

    socket.on('disconnect', () => {
        console.log('Felhasználó lecsatlakozott:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`A szerver fut a ${PORT}-es porton.`);
});
