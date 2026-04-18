#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SESSION_FILE = process.env.SESSION_FILE ? path.resolve(process.env.SESSION_FILE) : path.join(__dirname, '.bot_session.json');
const BASE_URL = 'http://127.0.0.1:3001/api/bot';

function getSession() {
    if (!fs.existsSync(SESSION_FILE)) {
        console.error("No active session. Run 'join' first.");
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
}

async function joinRoom(playerName = "Antigravity", roomId = "main") {
    const res = await fetch(`${BASE_URL}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerName })
    });
    const data = await res.json();
    if (data.success) {
        fs.writeFileSync(SESSION_FILE, JSON.stringify({ roomId, playerId: data.playerId, playerName }));
        console.log(`✅ Successfully joined room '${roomId}' as '${playerName}'`);
        console.log(`Bot ID: ${data.playerId}`);
    } else {
        console.error("❌ Failed to join:", data.error);
    }
}

async function getStatus() {
    const session = getSession();
    const res = await fetch(`${BASE_URL}/state/${session.roomId}/${session.playerId}`);
    const data = await res.json();
    
    if (data.error) {
        console.error("❌ Error fetching state:", data.error);
        process.exit(1);
    }

    const { state, hand } = data;
    console.log(`\n=== ROOM: ${session.roomId} | STATE: ${state.state} ===`);
    
    if (state.log && state.log.length > 0) {
        console.log("\n--- GAME LOG (Last 5) ---");
        state.log.slice(-5).forEach(l => console.log(l));
    }

    const activePlayer = state.players[state.turn];
    console.log(`\n--- PLAYERS ---`);
    state.players.forEach((p, idx) => {
        const isMe = p.id === session.playerId ? '(YOU)' : '';
        const isActive = idx === state.turn ? '=> ' : '   ';
        console.log(`${isActive}${p.name} ${isMe} [${p.cardCount} cards]`);
    });

    if (state.lastPlay) {
        const lastP = state.players.find(p => p.id === state.lastPlay.playerId)?.name || 'Someone';
        const cards = state.lastPlay.cards.map(c => c.suit + c.rank).join(', ');
        console.log(`\n=> CURRENT TRICK: ${lastP} played ${cards}`);
    } else {
         console.log(`\n=> CURRENT TRICK: (Empty)`);
    }

    console.log(`\n--- YOUR HAND ---`);
    if (hand.length === 0) {
        console.log("(Empty)");
    } else {
        const handStrs = hand.map((c, i) => `[${i}] ${c.suit}${c.rank}`);
        for (let i = 0; i < handStrs.length; i += 5) {
            console.log(handStrs.slice(i, i + 5).join('   '));
        }
    }
    
    console.log("\nCommands: 'play 0,1,2', 'pass'");
}

async function playCards(indicesStr) {
    const session = getSession();
    let cardIndices = [];
    if (indicesStr) {
        cardIndices = indicesStr.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    }
    
    const res = await fetch(`${BASE_URL}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            roomId: session.roomId, 
            playerId: session.playerId, 
            cardIndices 
        })
    });
    const data = await res.json();
    
    if (data.success) {
        console.log(`✅ Play successful! Action type: ${data.type}`);
    } else {
        console.error(`❌ Play rejected: ${data.error}`);
    }
}

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
    console.log("Usage: node bot_cli.js <command> [args]");
    console.log("Commands:");
    console.log("  join [playerName] [roomId]  - Join a game table");
    console.log("  status                      - Log game state and your hand");
    console.log("  play [0,1,2]                - Play cards by index");
    console.log("  pass                        - Pass turn");
    process.exit(0);
}

switch (command) {
    case 'join':
        joinRoom(args[1], args[2]);
        break;
    case 'status':
        getStatus();
        break;
    case 'play':
        playCards(args[1]);
        break;
    case 'pass':
        playCards('');
        break;
    default:
        console.error("Unknown command:", command);
}
