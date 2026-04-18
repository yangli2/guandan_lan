const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const Game = require('./logic/game');

const AVATARS = ['User', 'Smile', 'Ghost', 'Rocket', 'Crown', 'Star', 'Heart', 'Anchor', 'Compass', 'Gift'];

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3001;
const LOG_DIR = path.join(__dirname, 'logs');
const CONTROL_IN = path.join(__dirname, 'control_in.json');
const CONTROL_OUT = path.join(__dirname, 'control_out.json');

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR);

let games = {}; // roomId -> Game instance
let socketMap = {}; // socketId -> { roomId, playerId }

// Session Logging Helper
function logSession(gameId, data) {
    const logFile = path.join(LOG_DIR, `session_${gameId}.json`);
    let history = [];
    if (fs.existsSync(logFile)) {
        history = JSON.parse(fs.readFileSync(logFile));
    }
    history.push({ timestamp: new Date(), ...data });
    fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
}

io.on('connection', (socket) => {
    // Check if this socket matches a known mapping (reconnect case)
    let knownPlayer = null;
    if (socketMap[socket.id]) {
        knownPlayer = socketMap[socket.id].playerId;
    }
    console.log(`User connected [${socket.id}]${knownPlayer ? ` - Recognized as player: ${knownPlayer}` : ' - New Session'}`);

    socket.on('get_room_info', (roomId) => {
        const game = games[roomId];
        if (game) {
            socket.emit('room_info', game.getState());
        } else {
            socket.emit('room_info', null);
        }
    });

    socket.on('reconnect_player', ({ roomId, playerId }) => {
        const game = games[roomId];
        if (game) {
            const player = game.players.find(p => p.id === playerId);
            if (player) {
                player.socketId = socket.id;
                player.connected = true;
                socketMap[socket.id] = { roomId, playerId };
                socket.join(roomId);
                socket.emit('join_success');
                io.to(roomId).emit('game_update', game.getState());
                socket.emit('private_hand', player.hand);
                logSession(roomId, { event: 'player_reconnected', playerId });
            }
        }
    });

    socket.on('join_room', ({ roomId, playerName }) => {
        console.log(`Join attempt: Room ${roomId}, Player: ${playerName}`);
        if (!games[roomId]) {
            games[roomId] = new Game(roomId);
        }
        const game = games[roomId];
        const randomIcon = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        const player = { id: socket.id, name: playerName, socketId: socket.id, icon: randomIcon };
        
        if (game.join(player)) {
            socketMap[socket.id] = { roomId, playerId: socket.id };
            socket.join(roomId);
            socket.emit('join_success');
            io.to(roomId).emit('game_update', game.getState());
            logSession(roomId, { event: 'player_joined', playerName });
            console.log(`Join success: ${playerName} in ${roomId}`);
        } else {
            socket.emit('error', 'Room full');
            console.warn(`Join failed: ${roomId} is full`);
        }
    });

    socket.on('start_game', (roomId) => {
        const game = games[roomId];
        if (game && game.start()) {
            io.to(roomId).emit('game_update', game.getState());
            // Send private hands
            game.players.forEach(p => {
                io.to(p.socketId).emit('private_hand', p.hand);
            });
            logSession(roomId, { event: 'game_started' });
        }
    });

    socket.on('play_cards', ({ roomId, cardIndices }) => {
        const game = games[roomId];
        const mapping = socketMap[socket.id];
        if (game && mapping) {
            const result = game.play(mapping.playerId, cardIndices);
            if (result.success) {
                socket.emit('play_success');
                io.to(roomId).emit('game_update', game.getState());
                // Refresh hands
                game.players.forEach(p => {
                    io.to(p.socketId).emit('private_hand', p.hand);
                });
                logSession(roomId, { event: 'play', playerId: mapping.playerId, cardIndices, type: result.type });
            } else {
                socket.emit('error', result.error);
            }
        }
    });

    socket.on('disconnect', () => {
        const mapping = socketMap[socket.id];
        if (mapping) {
            const game = games[mapping.roomId];
            if (game) {
                const player = game.players.find(p => p.id === mapping.playerId);
                if (player) {
                    player.connected = false;
                    io.to(mapping.roomId).emit('game_update', game.getState());
                    logSession(mapping.roomId, { event: 'player_disconnected', playerId: mapping.playerId });
                }
            }
            delete socketMap[socket.id];
        }
    });

    socket.on('return_tribute', ({ roomId, cardIndex }) => {
        const game = games[roomId];
        const mapping = socketMap[socket.id];
        if (game && mapping) {
            const result = game.returnTribute(mapping.playerId, cardIndex);
            if (result.success) {
                io.to(roomId).emit('game_update', game.getState());
                game.players.forEach(p => {
                    if (p.socketId) io.to(p.socketId).emit('private_hand', p.hand);
                });
            } else {
                socket.emit('error', result.error);
            }
        }
    });

    socket.on('reset_room', (roomId) => {
        if (games[roomId]) {
            games[roomId] = new Game(roomId);
            io.to(roomId).emit('game_update', games[roomId].getState());
            io.to(roomId).emit('force_reload');
            logSession(roomId, { event: 'room_reset' });
        }
    });
});

// Control Interface Watcher
chokidar.watch(CONTROL_IN).on('change', () => {
    try {
        const content = fs.readFileSync(CONTROL_IN, 'utf8');
        if (!content) return;
        const cmd = JSON.parse(content);
        console.log('Received command:', cmd);

        if (cmd.type === 'SERVER_PLAY') {
            const game = games[cmd.roomId];
            if (game) {
                const player = game.players[game.turn];
                const result = game.play(player.id, cmd.cardIndices);
                if (result.success) {
                    io.to(cmd.roomId).emit('game_update', game.getState());
                    game.players.forEach(p => {
                        io.to(p.socketId).emit('private_hand', p.hand);
                    });
                    logSession(cmd.roomId, { event: 'server_force_play', player: player.name, cardIndices: cmd.cardIndices });
                }
            }
        }
        
        if (cmd.type === 'GET_STATE') {
            const game = games[cmd.roomId];
            if (game) {
                fs.writeFileSync(CONTROL_OUT, JSON.stringify({ status: 'OK', state: game.getState() }));
            } else {
                fs.writeFileSync(CONTROL_OUT, JSON.stringify({ status: 'ERROR', message: 'Game not found' }));
            }
            return;
        }
    } catch (err) {
        console.error('Control interface error:', err);
    }
});

// Bot Control REST API
app.post('/api/bot/join', (req, res) => {
    const { roomId, playerName } = req.body;
    if (!roomId || !playerName) return res.status(400).json({ error: 'Missing roomId or playerName' });
    
    if (!games[roomId]) {
        games[roomId] = new Game(roomId);
    }
    const game = games[roomId];
    
    // Check if player name already exists (reconnect case for bot)
    let existingPlayer = game.players.find(p => p.name === playerName);
    let playerId;
    
    if (existingPlayer) {
        playerId = existingPlayer.id;
        // Optional: override socket if bot masquerading, but bots have null socket connections for now
        existingPlayer.connected = true; // pretend connected
    } else {
        const { v4: uuidv4 } = require('uuid');
        playerId = 'bot-' + uuidv4().slice(0, 8);
        const randomIcon = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        const player = { id: playerId, name: playerName, socketId: null, icon: randomIcon };
        
        if (!game.join(player)) {
            return res.status(400).json({ error: 'Room full' });
        }
    }

    io.to(roomId).emit('game_update', game.getState());
    logSession(roomId, { event: 'bot_joined', playerName });
    res.json({ success: true, playerId });
});

app.get('/api/bot/state/:roomId/:playerId', (req, res) => {
    const { roomId, playerId } = req.params;
    const game = games[roomId];
    if (!game) return res.status(404).json({ error: 'Game not found' });
    
    const player = game.players.find(p => p.id === playerId);
    if (!player) return res.status(404).json({ error: 'Player not found in game' });
    
    res.json({
        state: game.getState(),
        hand: player.hand
    });
});

app.post('/api/bot/play', (req, res) => {
    const { roomId, playerId, cardIndices } = req.body;
    const game = games[roomId];
    if (!game) return res.status(404).json({ error: 'Game not found' });
    
    const result = game.play(playerId, cardIndices || []);
    if (result.success) {
        io.to(roomId).emit('game_update', game.getState());
        // Normal human clients get hands updated
        game.players.forEach(p => {
            if (p.socketId) io.to(p.socketId).emit('private_hand', p.hand);
        });
        logSession(roomId, { event: 'bot_play', playerId, cardIndices, type: result.type });
        res.json({ success: true, type: result.type });
    } else {
        res.status(400).json({ error: result.error });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
