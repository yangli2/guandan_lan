const fs = require('fs');
const path = require('path');
const Game = require('./game');

class RoomManager {
    constructor(logDir) {
        this.games = {};
        this.logDir = logDir;
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getGame(roomId) {
        return this.games[roomId];
    }

    createRoom(roomId) {
        if (!this.games[roomId]) {
            this.games[roomId] = new Game(roomId);
        }
        return this.games[roomId];
    }

    joinRoom(roomId, player) {
        const game = this.createRoom(roomId);
        const success = game.join(player);
        if (success) {
            this.logSession(roomId, { event: 'player_joined', playerName: player.name });
        }
        return { success, game };
    }

    playCards(roomId, playerId, cardIndices) {
        const game = this.getGame(roomId);
        if (!game) return { error: 'Game not found' };

        const result = game.play(playerId, cardIndices);
        if (result.success) {
            this.logSession(roomId, { 
                event: 'play', 
                playerId, 
                cardIndices, 
                type: result.type, 
                cards: result.type === 'PLAY' ? game.lastPlay.cards : [] 
            });
        } else {
            this.logSession(roomId, { 
                event: 'play_cards_error', 
                playerId, 
                cardIndices, 
                error: result.error 
            });
        }
        return result;
    }

    botPlay(roomId, playerId, cardIndices) {
        const game = this.getGame(roomId);
        if (!game) return { error: 'Game not found' };

        const result = game.play(playerId, cardIndices || []);
        if (result.success) {
            this.logSession(roomId, { 
                event: 'bot_play', 
                playerId, 
                cardIndices, 
                type: result.type, 
                cards: result.type === 'PLAY' ? game.lastPlay.cards : (result.card ? [result.card] : []) 
            });
        } else {
            this.logSession(roomId, { 
                event: 'bot_play_error', 
                playerId, 
                cardIndices, 
                error: result.error 
            });
        }
        return result;
    }

    returnTribute(roomId, playerId, cardIndex) {
        const game = this.getGame(roomId);
        if (!game) return { error: 'Game not found' };

        const result = game.returnTribute(playerId, cardIndex);
        if (result.success) {
            this.logSession(roomId, { event: 'return_tribute', playerId, cardIndex, card: result.card });
        }
        return result;
    }

    logSession(gameId, data) {
        const game = this.games[gameId];
        let sequenceNumber = 0;
        let roundId = 'unknown';
        let hands = null;
        
        if (game) {
            sequenceNumber = ++game.sequenceNumber;
            roundId = game.roundId;
            const state = game.getState();
            hands = game.players.reduce((acc, p) => {
                acc[p.id] = p.hand;
                return acc;
            }, {});
            
            // Include state info for debugging
            data.currentLevel = state.currentLevel;
            data.teamLevels = state.teamLevels;
            data.currentTeamTurn = state.currentTeamTurn;
            data.winners = state.winners;
        }
        
        const logFile = path.join(this.logDir, `session_${gameId}.json`);
        let history = [];
        try {
            if (fs.existsSync(logFile)) {
                history = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            }
            history.push({ timestamp: new Date(), roundId, sequenceNumber, hands, ...data });
            fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
        } catch (err) {
            console.error('Error logging session:', err);
        }
    }
}

module.exports = RoomManager;
