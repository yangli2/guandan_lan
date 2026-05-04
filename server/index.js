const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const RoomManager = require('./logic/RoomManager');

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
let LOG_DIR = path.join(__dirname, 'logs');
const logDirIndex = process.argv.indexOf('--log-dir');
if (logDirIndex !== -1 && process.argv[logDirIndex + 1]) {
    LOG_DIR = path.resolve(process.cwd(), process.argv[logDirIndex + 1]);
}
const CONTROL_IN = path.join(__dirname, 'control_in.json');
const CONTROL_OUT = path.join(__dirname, 'control_out.json');

const roomManager = new RoomManager(LOG_DIR);
let socketMap = {}; // socketId -> { roomId, playerId }

function notifyGameState(roomId) {
    const game = roomManager.getGame(roomId);
    if (game) {
        io.to(roomId).emit('game_update', game.getState());
        game.players.forEach(p => {
            if (p.socketId) io.to(p.socketId).emit('private_hand', p.hand);
        });
    }
}

function maybeAutoStartGame(game, roomId) {
    if (game.players.length === 4 && game.state === 'LOBBY') {
        if (game.start()) {
            roomManager.logSession(roomId, { event: 'game_started_auto' });
            notifyGameState(roomId);
            return true;
        }
    }
    return false;
}

function checkAutoRestartGame(game, roomId) {
    if (game.state === 'FINISHED') {
        setTimeout(() => {
            if (game.start()) {
                roomManager.logSession(roomId, { event: 'game_started_auto_next_round' });
                notifyGameState(roomId);
            }
        }, 3000);
    }
}

io.on('connection', (socket) => {
    socket.on('get_room_info', (roomId) => {
        const game = roomManager.getGame(roomId);
        socket.emit('room_info', game ? game.getState() : null);
    });

    socket.on('reconnect_player', ({ roomId, playerId }) => {
        const game = roomManager.getGame(roomId);
        if (game) {
            const player = game.players.find(p => p.id === playerId);
            if (player) {
                player.socketId = socket.id;
                player.connected = true;
                socketMap[socket.id] = { roomId, playerId };
                socket.join(roomId);
                socket.emit('join_success');
                roomManager.logSession(roomId, { event: 'player_reconnected', playerId });
                notifyGameState(roomId);
            }
        }
    });

    socket.on('join_room', ({ roomId, playerName }) => {
        const randomIcon = AVATARS[Math.floor(Math.random() * AVATARS.length)];
        const player = { id: socket.id, name: playerName, socketId: socket.id, icon: randomIcon };
        
        const { success, game } = roomManager.joinRoom(roomId, player);
        if (success) {
            socketMap[socket.id] = { roomId, playerId: socket.id };
            socket.join(roomId);
            socket.emit('join_success');
            if (!maybeAutoStartGame(game, roomId)) {
                notifyGameState(roomId);
            }
        } else {
            socket.emit('error', 'Room full');
        }
    });

    socket.on('start_game', (roomId) => {
        const game = roomManager.getGame(roomId);
        if (game && game.start()) {
            roomManager.logSession(roomId, { event: 'game_started' });
            notifyGameState(roomId);
        }
    });

    socket.on('play_cards', ({ roomId, cardIndices }) => {
        const mapping = socketMap[socket.id];
        if (mapping) {
            const result = roomManager.playCards(roomId, mapping.playerId, cardIndices);
            if (result.success) {
                socket.emit('play_success');
                notifyGameState(roomId);
                checkAutoRestartGame(roomManager.getGame(roomId), roomId);
            } else {
                socket.emit('error', result.error);
            }
        }
    });

    socket.on('return_tribute', ({ roomId, cardIndex }) => {
        const mapping = socketMap[socket.id];
        if (mapping) {
            const result = roomManager.returnTribute(roomId, mapping.playerId, cardIndex);
            if (result.success) {
                notifyGameState(roomId);
            } else {
                socket.emit('error', result.error);
            }
        }
    });

    socket.on('reset_room', (roomId) => {
        const game = roomManager.createRoom(roomId); // This is actually a bit weird, should have a resetRoom in roomManager
        // For now, let's just re-instantiate if needed or add reset method
        // Re-using createRoom for simplicity as it returns the existing or new one.
        // Actually we need to FORCE a new one.
        roomManager.games[roomId] = new (require('./logic/game'))(roomId);
        roomManager.logSession(roomId, { event: 'room_reset' });
        notifyGameState(roomId);
        io.to(roomId).emit('force_reload');
    });

    socket.on('disconnect', () => {
        const mapping = socketMap[socket.id];
        if (mapping) {
            const game = roomManager.getGame(mapping.roomId);
            if (game) {
                const player = game.players.find(p => p.id === mapping.playerId);
                if (player) {
                    player.connected = false;
                    roomManager.logSession(mapping.roomId, { event: 'player_disconnected', playerId: mapping.playerId });
                    notifyGameState(mapping.roomId);
                }
            }
            delete socketMap[socket.id];
        }
    });
});

// Control Interface
chokidar.watch(CONTROL_IN).on('change', () => {
    try {
        const content = fs.readFileSync(CONTROL_IN, 'utf8');
        if (!content) return;
        const cmd = JSON.parse(content);
        if (cmd.type === 'SERVER_PLAY') {
            const result = roomManager.playCards(cmd.roomId, roomManager.getGame(cmd.roomId).players[roomManager.getGame(cmd.roomId).turn].id, cmd.cardIndices);
            if (result.success) notifyGameState(cmd.roomId);
        }
        if (cmd.type === 'GET_STATE') {
            const game = roomManager.getGame(cmd.roomId);
            fs.writeFileSync(CONTROL_OUT, JSON.stringify({ status: game ? 'OK' : 'ERROR', state: game ? game.getState() : null }));
        }
    } catch (err) { console.error('Control error:', err); }
});

// Bot API
app.post('/api/bot/join', (req, res) => {
    const { roomId, playerName } = req.body;
    const game = roomManager.createRoom(roomId);
    let player = game.players.find(p => p.name === playerName);
    if (!player) {
        const playerId = 'bot-' + require('uuid').v4().slice(0, 8);
        player = { id: playerId, name: playerName, socketId: null, icon: AVATARS[0] };
        if (!game.join(player)) return res.status(400).json({ error: 'Room full' });
    }
    player.connected = true;
    roomManager.logSession(roomId, { event: 'bot_joined', playerName });
    if (!maybeAutoStartGame(game, roomId)) notifyGameState(roomId);
    res.json({ success: true, playerId: player.id });
});

app.get('/api/bot/state/:roomId/:playerId', (req, res) => {
    const { roomId, playerId } = req.params;
    const game = roomManager.getGame(roomId);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    const player = game.players.find(p => p.id === playerId);
    res.json({ state: game.getState(), hand: player ? player.hand : [] });
});

app.post('/api/bot/play', (req, res) => {
    const { roomId, playerId, cardIndices } = req.body;
    const result = roomManager.botPlay(roomId, playerId, cardIndices);
    if (result.success) {
        notifyGameState(roomId);
        checkAutoRestartGame(roomManager.getGame(roomId), roomId);
        res.json({ success: true, type: result.type });
    } else {
        res.status(400).json({ error: result.error });
    }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
