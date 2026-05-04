jest.mock('uuid', () => ({
    v4: () => 'mock-uuid'
}));

const RoomManager = require('../logic/RoomManager');
const fs = require('fs');
const path = require('path');

describe('RoomManager', () => {
    const logDir = path.join(__dirname, 'test_logs');
    let rm;

    beforeEach(() => {
        if (fs.existsSync(logDir)) {
            fs.rmSync(logDir, { recursive: true });
        }
        rm = new RoomManager(logDir);
    });

    afterAll(() => {
        if (fs.existsSync(logDir)) {
            fs.rmSync(logDir, { recursive: true });
        }
    });

    test('Creating and getting rooms', () => {
        const game = rm.createRoom('room1');
        expect(game.id).toBe('room1');
        expect(rm.getGame('room1')).toBe(game);
        expect(rm.getGame('non-existent')).toBeUndefined();
    });

    test('Joining a room via RoomManager', () => {
        const player = { id: 'p1', name: 'Alice' };
        const { success, game } = rm.joinRoom('room1', player);
        expect(success).toBe(true);
        expect(game.players.length).toBe(1);
        expect(game.players[0].name).toBe('Alice');
        
        // Verify log entry
        const logPath = path.join(logDir, 'session_room1.json');
        expect(fs.existsSync(logPath)).toBe(true);
        const log = JSON.parse(fs.readFileSync(logPath, 'utf8'));
        expect(log[0].event).toBe('player_joined');
    });

    test('Playing cards via RoomManager', () => {
        const roomId = 'room1';
        rm.createRoom(roomId);
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => rm.joinRoom(roomId, p));
        const game = rm.getGame(roomId);
        game.start();

        const result = rm.playCards(roomId, 'p1', [0]);
        expect(result.success).toBe(true);
        
        // Verify log entry
        const log = JSON.parse(fs.readFileSync(path.join(logDir, `session_${roomId}.json`), 'utf8'));
        const playLog = log.find(entry => entry.event === 'play');
        expect(playLog).toBeDefined();
        expect(playLog.playerId).toBe('p1');
    });

    test('Handling errors in playCards', () => {
        const roomId = 'room1';
        rm.createRoom(roomId);
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => rm.joinRoom(roomId, p));
        rm.getGame(roomId).start();

        // Not p2's turn
        const result = rm.playCards(roomId, 'p2', [0]);
        expect(result.error).toBeDefined();
        
        // Verify error log entry
        const log = JSON.parse(fs.readFileSync(path.join(logDir, `session_${roomId}.json`), 'utf8'));
        const errorLog = log.find(entry => entry.event === 'play_cards_error');
        expect(errorLog).toBeDefined();
        expect(errorLog.error).toBe(result.error);
    });

    test('botPlay via RoomManager', () => {
        const roomId = 'room1';
        rm.createRoom(roomId);
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => rm.joinRoom(roomId, p));
        rm.getGame(roomId).start();

        const result = rm.botPlay(roomId, 'p1', [0]);
        expect(result.success).toBe(true);
        
        const log = JSON.parse(fs.readFileSync(path.join(logDir, `session_${roomId}.json`), 'utf8'));
        expect(log.some(e => e.event === 'bot_play')).toBe(true);
    });

    test('returnTribute via RoomManager', () => {
        const roomId = 'room1';
        const game = rm.createRoom(roomId);
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => rm.joinRoom(roomId, p));
        
        // Force tribute state
        game.winners = ['p1', 'p2', 'p3', 'p4'];
        game.start();
        expect(game.state).toBe('RETURN_TRIBUTE');

        const result = rm.returnTribute(roomId, 'p1', 0);
        expect(result.success).toBe(true);
        
        const log = JSON.parse(fs.readFileSync(path.join(logDir, `session_${roomId}.json`), 'utf8'));
        expect(log.some(e => e.event === 'return_tribute')).toBe(true);
    });
});
