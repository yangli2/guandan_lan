const { SUITS, RANKS, JOKERS } = require('./constants');
const { analyzeCombo, compareCombos } = require('./engine');
const { v4: uuidv4 } = require('uuid');

class Game {
    constructor(roomId) {
        this.id = roomId || uuidv4();
        this.players = []; // { id, name, socketId, hand, team }
        this.state = 'LOBBY';
        
        // Guandan Progression
        this.teamLevels = ['2', '2']; // Rank for Team 0 and Team 1
        this.levelFailCounts = [0, 0]; // Counts for failing Level A
        this.currentTeamTurn = 0; // Which team's level is active
        
        this.turn = 0;
        this.lastPlay = null; // { cards, combo, playerId }
        this.playedHistory = [];
        this.winners = []; // Order of players who finished
        this.log = []; // Game event messages

        // Tribute State
        this.tributeInfo = null; // { from: [], to: [], resistance: boolean }
    }

    addLog(msg) {
        this.log.push(`[${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}] ` + msg);
        if (this.log.length > 50) this.log.shift();
    }

    join(player) {
        if (this.players.length < 4) {
            player.team = this.players.length % 2;
            player.hand = [];
            player.connected = true;
            this.players.push(player);
            this.addLog(`${player.name} joined the table.`);
            return true;
        }
        return false;
    }

    start() {
        if (this.players.length !== 4) return false;
        
        const oldWinners = [...this.winners];
        
        // Logic for determining next round's level
        if (oldWinners.length > 0) {
            this.processEndGame();
        }

        this.state = 'PLAYING';
        this.deal();
        this.winners = [];
        this.lastPlay = null;
        this.playedHistory = [];
        this.turn = 0; // Default

        // Check for Tribute (uses old winners to move cards in NEW hands)
        if (oldWinners.length > 0) {
            this.setupTribute(oldWinners);
        } else {
            this.turn = 0;
        }

        this.addLog(`Game started! Team 0 is level ${this.teamLevels[0]}, Team 1 is level ${this.teamLevels[1]}`);
        return true;
    }

    processEndGame() {
        const firstWinner = this.players.find(p => p.id === this.winners[0]);
        const secondWinner = this.players.find(p => p.id === this.winners[1]);
        const winTeam = firstWinner.team;
        const otherTeam = 1 - winTeam;

        let levelUp = 0;
        if (secondWinner.team === winTeam) {
            levelUp = 3; // Double win
            this.addLog(`Team ${winTeam} double win! Level up 3.`);
        } else if (this.winners.length >= 3) {
            const thirdWinner = this.players.find(p => p.id === this.winners[2]);
            if (thirdWinner.team === winTeam) {
                levelUp = 2; // 1st & 3rd
                this.addLog(`Team ${winTeam} took 1st and 3rd! Level up 2.`);
            } else {
                levelUp = 1; // 1st & 4th
                this.addLog(`Team ${winTeam} took 1st and 4th! Level up 1.`);
            }
        }

        // Apply Level Up
        const oldLevelIndex = RANKS.indexOf(this.teamLevels[winTeam]);
        let newLevelIndex = oldLevelIndex + levelUp;
        
        if (newLevelIndex >= RANKS.length) newLevelIndex = RANKS.length - 1;
        const newLevel = RANKS[newLevelIndex];

        // Level A Penalty Logic
        if (this.teamLevels[winTeam] === 'A') {
            if (levelUp > 0) {
                this.addLog(`Team ${winTeam} WINS THE MATCH!`);
                // In a real environment, we'd reset or celebrate. Reset to 2 for now.
                this.teamLevels = ['2', '2'];
            } else {
                this.levelFailCounts[winTeam]++;
                if (this.levelFailCounts[winTeam] >= 3) {
                    this.addLog(`Team ${winTeam} failed Level A 3 times. Reset to Level 2.`);
                    this.teamLevels[winTeam] = '2';
                    this.levelFailCounts[winTeam] = 0;
                }
            }
        } else {
            this.teamLevels[winTeam] = newLevel;
            if (newLevel === 'A') this.levelFailCounts[winTeam] = 0;
        }

        this.currentTeamTurn = winTeam;
    }

    setupTribute(oldWinnerIds) {
        const first = this.players.find(p => p.id === oldWinnerIds[0]);
        const second = this.players.find(p => p.id === oldWinnerIds[1]);
        const third = this.players.find(p => p.id === oldWinnerIds[2]);
        const last = this.players.find(p => p.id === oldWinnerIds[3]);

        if (!first || !last) {
            this.turn = 0;
            return;
        }

        this.state = 'TRIBUTE';
        this.tributeInfo = { tributes: [], returns: [], history: [] };

        const isDoubleWin = second.team === first.team;
        
        if (isDoubleWin) {
            this.addTributeAction(last, first);
            this.addTributeAction(third, second);
        } else {
            this.addTributeAction(last, first);
        }

        const losers = isDoubleWin ? [last, third] : [last];
        const totalBJs = losers.reduce((sum, p) => sum + (p.hand.filter(c => c.rank === 'BJ').length), 0);
        
        if (totalBJs >= 2) {
            this.addLog("RESISTANCE! Tribute cancelled due to 2 Big Jokers.");
            this.state = 'PLAYING';
            this.tributeInfo = null;
            this.turn = this.players.indexOf(first);
        } else {
            this.tributeInfo.tributes.forEach(t => {
                const highest = this.findHighestTributeCard(t.from);
                if (highest && highest.card) {
                    const card = t.from.hand.splice(highest.index, 1)[0];
                    t.to.hand.push(card);
                    this.addLog(`${t.from.name} tributed ${card.suit || ''}${card.rank} to ${t.to.name}`);
                    this.tributeInfo.history.push({
                        fromName: t.from.name,
                        toName: t.to.name,
                        card: card
                    });
                }
            });

            this.state = 'RETURN_TRIBUTE';
            this.turn = this.players.indexOf(first);

            if (process.env.E2E_SHORT_GAME === '1') {
                this.addLog("E2E MODE: Automating return tribute...");
                const actions = [...this.tributeInfo.tributes];
                actions.forEach(t => {
                    this.returnTribute(t.to.id, 0);
                });
            }
        }
    }

    addTributeAction(fromPlayer, toPlayer) {
        this.tributeInfo.tributes.push({ from: fromPlayer, to: toPlayer });
    }

    findHighestTributeCard(player) {
        // Standard sorting, find max
        let maxVal = -1;
        let maxIdx = -1;
        player.hand.forEach((c, i) => {
            const val = this.getTributeValue(c);
            if (val > maxVal) {
                maxVal = val;
                maxIdx = i;
            }
        });
        return { index: maxIdx, card: player.hand[maxIdx] };
    }

    getTributeValue(card) {
        if (card.rank === 'BJ') return 100;
        if (card.rank === 'SJ') return 90;
        const currentLevel = this.teamLevels[this.currentTeamTurn];
        if (card.rank === currentLevel) return 80;
        return RANKS.indexOf(card.rank);
    }

    returnTribute(playerId, cardIndex) {
        if (this.state !== 'RETURN_TRIBUTE') return { error: "Not tribute phase" };
        const winner = this.players.find(p => p.id === playerId);
        const action = this.tributeInfo.tributes.find(t => t.to.id === playerId);
        
        if (!action) return { error: "You don't owe a return" };
        
        const card = winner.hand[cardIndex];
        // Standard rule: cannot return cards > 10? Actually varies, let's allow anything for now.
        
        winner.hand.splice(cardIndex, 1);
        action.from.hand.push(card);
        this.addLog(`${winner.name} returned a card to ${action.from.name}`);
        
        // Check if all returns done
        const returnsNeeded = this.tributeInfo.tributes.length;
        this.tributeInfo.returns.push(playerId);
        if (this.tributeInfo.returns.length >= returnsNeeded) {
            this.state = 'PLAYING';
            this.tributeInfo = null;
        }
        return { success: true };
    }

    deal() {
        const level = this.teamLevels[this.currentTeamTurn];
        if (process.env.E2E_SHORT_GAME === '1') {
            const shortHands = [
                [{ suit: 'S', rank: '3' }, { suit: 'S', rank: '7' }, { suit: 'S', rank: level }],
                [{ suit: 'S', rank: '4' }, { suit: 'S', rank: '8' }, { suit: 'S', rank: 'Q' }],
                [{ suit: 'S', rank: '5' }, { suit: 'S', rank: '9' }, { suit: 'S', rank: 'K' }],
                [{ suit: 'S', rank: '6' }, { suit: 'S', rank: '10' }, { suit: 'S', rank: 'A' }]
            ];
            this.players.forEach((p, idx) => {
                p.hand = shortHands[idx];
            });
            return;
        }

        const deck = [];
        for (let i = 0; i < 2; i++) {
            for (let suit of SUITS) {
                for (let rank of RANKS) {
                    deck.push({ suit, rank });
                }
            }
            deck.push({ rank: 'SJ' });
            deck.push({ rank: 'BJ' });
        }

        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }

        this.players.forEach((p, idx) => {
            p.hand = deck.slice(idx * 27, (idx + 1) * 27);
        });
    }

    play(playerId, cardIndices) {
        if (this.state === 'RETURN_TRIBUTE') {
            return this.returnTribute(playerId, cardIndices[0]);
        }
        
        const playerIdx = this.players.findIndex(p => p.id === playerId);
        if (playerIdx !== this.turn) return { error: "Not your turn" };

        const player = this.players[playerIdx];
        const cards = cardIndices.map(i => player.hand[i]);
        
        const level = this.teamLevels[player.team];

        if (cards.length === 0) {
            this.addLog(`${player.name} passed.`);
            this.nextTurn();
            return { success: true, type: 'PASS' };
        }

        const combo = analyzeCombo(cards, level);
        if (!combo) return { error: "Invalid combination" };

        if (!compareCombos(this.lastPlay ? this.lastPlay.combo : null, combo)) {
            return { error: "Combination too weak" };
        }

        const cardStr = cards.map(c => (c.suit || '') + c.rank).join(', ');
        this.addLog(`${player.name} played: ${cardStr}`);
        
        player.hand = player.hand.filter((_, i) => !cardIndices.includes(i));
        this.lastPlay = { cards, combo, playerId };
        this.playedHistory.push(this.lastPlay);

        if (player.hand.length === 0 && !this.winners.includes(playerId)) {
            this.winners.push(playerId);
            const placement = this.winners.length;
            const placeStr = placement === 1 ? '1st' : placement === 2 ? '2nd' : '3rd';
            this.addLog(`🎉 ${player.name} finished in ${placeStr} place!`);
            
            if (this.winners.length === 3) {
                const lastPlayer = this.players.find(p => !this.winners.includes(p.id));
                this.winners.push(lastPlayer.id);
                this.state = 'FINISHED';
                this.addLog('Game Over!');
            }
        }

        this.nextTurn();
        return { success: true, type: 'PLAY', combo };
    }

    nextTurn() {
        if (this.state !== 'PLAYING') return;
        const previousLeadId = this.lastPlay ? this.lastPlay.playerId : null;
        this.turn = (this.turn + 1) % 4;
        
        while (this.players[this.turn].hand.length === 0) {
            if (previousLeadId && this.players[this.turn].id === previousLeadId) {
                this.lastPlay = null;
                this.turn = (this.turn + 2) % 4;
                continue; 
            }
            this.turn = (this.turn + 1) % 4;
        }

        if (this.lastPlay && this.players[this.turn].id === this.lastPlay.playerId) {
            this.lastPlay = null; 
        }
    }

    getState() {
        return {
            id: this.id,
            state: this.state,
            teamLevels: this.teamLevels,
            currentLevel: this.teamLevels[this.currentTeamTurn],
            turn: this.turn,
            lastPlay: this.lastPlay,
            winners: this.winners,
            log: this.log,
            tributeInfo: this.tributeInfo ? {
                history: this.tributeInfo.history,
                returns: this.tributeInfo.returns,
                tributes: this.tributeInfo.tributes.map(t => ({
                    fromId: t.from.id,
                    fromName: t.from.name,
                    toId: t.to.id,
                    toName: t.to.name
                }))
            } : null,
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                socketId: p.socketId,
                team: p.team,
                cardCount: p.hand.length,
                connected: p.connected,
                icon: p.icon
            }))
        };
    }
}

module.exports = Game;

