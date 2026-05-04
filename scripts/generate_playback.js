const fs = require('fs');
const path = require('path');
const { processLogs } = require('./playback_logic');

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node generate_playback.js <server_log_file> <output_html_file>");
    process.exit(1);
}

const inputFile = args[0];
const outputFile = args[1];

let logs = [];
try {
    logs = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
    console.error(`Error reading ${inputFile}:`, e.message);
    process.exit(1);
}

// Group and pre-process logs
const rounds = processLogs(logs);
const roundIds = Object.keys(rounds);

const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Guandan Interactive Playback</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #1e1e24; color: #fff; margin: 0; padding: 20px; }
        #controls { margin-bottom: 20px; padding: 15px; background-color: #2a2a35; border-radius: 8px; display: flex; gap: 15px; align-items: center; position: sticky; top: 10px; z-index: 1000; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        #scrubber { flex-grow: 1; }
        
        .table-container { display: flex; justify-content: center; align-items: center; min-height: 800px; }
        .table { position: relative; width: 1000px; height: 750px; background-color: #35654d; border-radius: 40px; border: 15px solid #2a4c3b; box-shadow: inset 0 0 50px rgba(0,0,0,0.5), 0 10px 30px rgba(0,0,0,0.5); }
        
        .player { position: absolute; background-color: rgba(0,0,0,0.7); padding: 15px; border-radius: 12px; text-align: center; border: 1px solid rgba(255,255,255,0.1); width: 280px; }
        .player-top { top: 20px; left: 50%; transform: translateX(-50%); }
        .player-bottom { bottom: 20px; left: 50%; transform: translateX(-50%); }
        .player-left { left: 20px; top: 50%; transform: translateY(-50%); }
        .player-right { right: 20px; top: 50%; transform: translateY(-50%); }
        
        .player.active { border: 2px solid #ffeb3b; box-shadow: 0 0 15px #ffeb3b; }
        
        .hand { display: flex; flex-wrap: wrap; gap: 4px; justify-content: center; margin-top: 10px; }
        .card { width: 34px; height: 50px; background: white; color: black; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; position: relative; border: 1px solid #ccc; box-shadow: 2px 2px 4px rgba(0,0,0,0.3); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); z-index: 10; }
        .card.red { color: #d32f2f; }
        .card.level-card { background: #fff9c4; border: 2px solid #fbc02d; }
        
        .center-info { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(0,0,0,0.6); padding: 30px; border-radius: 20px; min-width: 350px; border: 2px solid rgba(255,255,255,0.1); }
        .event-title { font-size: 24px; margin: 0 0 10px 0; color: #ffeb3b; }
        .played-cards { display: flex; gap: 8px; justify-content: center; margin-top: 15px; min-height: 60px; }
        .last-play-label { font-size: 12px; text-transform: uppercase; color: #aaa; margin-bottom: 5px; }

        .event-log { margin-top: 30px; padding: 20px; background: #2a2a35; border-radius: 12px; max-height: 300px; overflow-y: auto; font-family: 'Consolas', monospace; border: 1px solid rgba(255,255,255,0.1); }
        .log-entry { margin-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; }
        .log-agent { color: #81d4fa; }
        .log-server { color: #a5d6a7; }
        
        .tribute-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; margin-left: 10px; }
        .tribute-give { background: #e91e63; color: white; }
        .tribute-return { background: #4caf50; color: white; }
    </style>
</head>
<body>
    <div id="controls">
        <select id="round-select" style="padding: 8px; border-radius: 4px;"></select>
        <button id="prev-btn" style="padding: 8px 16px;">&lt; Prev</button>
        <input type="range" id="scrubber" min="0" value="0" step="1">
        <button id="next-btn" style="padding: 8px 16px;">Next &gt;</button>
        <span id="seq-display" style="min-width: 80px; font-weight: bold;">Seq: 0</span>
        <div id="level-display" style="background: #444; padding: 5px 15px; border-radius: 20px; font-weight: bold; border: 1px solid #666;">Level: ?</div>
    </div>
    
    <div class="table-container">
        <div class="table">
            <div class="player player-top" id="p-container-1">
                <strong id="p-name-1">Top Player</strong>
                <div class="hand" id="hand-1"></div>
            </div>
            <div class="player player-left" id="p-container-0">
                <strong id="p-name-0">Left Player</strong>
                <div class="hand" id="hand-0"></div>
            </div>
            <div class="player player-right" id="p-container-2">
                <strong id="p-name-2">Right Player</strong>
                <div class="hand" id="hand-2"></div>
            </div>
            <div class="player player-bottom" id="p-container-3">
                <strong id="p-name-3">Bottom Player</strong>
                <div class="hand" id="hand-3"></div>
            </div>
            
            <div class="center-info">
                <div class="last-play-label" id="play-status">Current Lead</div>
                <h3 class="event-title" id="event-title">Event</h3>
                <p id="event-details" style="margin: 5px 0; color: #ccc;"></p>
                <div class="played-cards" id="center-cards"></div>
            </div>
        </div>
    </div>
    
    <div class="event-log" id="event-log"></div>

    <script>
        const rounds = ${JSON.stringify(rounds)};
        const roundIds = Object.keys(rounds);
        
        const roundSelect = document.getElementById('round-select');
        const scrubber = document.getElementById('scrubber');
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        const seqDisplay = document.getElementById('seq-display');
        const levelDisplay = document.getElementById('level-display');
        
        let currentRoundId = roundIds.length > 0 ? roundIds[0] : null;
        let currentEventIndex = 0;
        
        const rankMap = {
            'A': 17, 'K': 16, 'Q': 15, 'J': 14, '10': 13, '9': 12, '8': 11, '7': 10, '6': 9, '5': 8, '4': 7, '3': 6, '2': 5
        };

        function getCardRankValue(rank, currentLevel) {
            if (rank === 'BJ') return 20;
            if (rank === 'SJ') return 19;
            if (rank === currentLevel) return 18;
            return rankMap[rank] || 0;
        }

        function sortCards(cards, currentLevel) {
            if (!cards) return [];
            return [...cards].sort((a, b) => {
                const valA = getCardRankValue(a.rank, currentLevel);
                const valB = getCardRankValue(b.rank, currentLevel);
                if (valA !== valB) return valB - valA;
                return (a.suit || '').localeCompare(b.suit || '');
            });
        }

        if (roundIds.length === 0) {
            document.body.innerHTML = '<h2>No valid rounds found in log file.</h2>';
        } else {
            roundIds.forEach((id, index) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = 'Round ' + (index + 1) + ' (' + id.slice(0,8) + '...)';
                roundSelect.appendChild(opt);
            });
            
            function getSuitIcon(suit) {
                switch(suit) {
                    case 'S': return '♠';
                    case 'H': return '♥';
                    case 'C': return '♣';
                    case 'D': return '♦';
                    default: return '';
                }
            }
            
            function renderCard(card, currentLevel) {
                if (!card) return '';
                const isRed = card.suit === 'H' || card.suit === 'D';
                const isLevel = card.rank === currentLevel;
                const suit = getSuitIcon(card.suit);
                return '<div class="card ' + (isRed ? 'red' : '') + (isLevel ? ' level-card' : '') + '">' + 
                       (card.rank === 'BJ' ? 'BJ' : card.rank === 'SJ' ? 'SJ' : card.rank) + 
                       suit + '</div>';
            }
            
            function updateUI() {
                const currentLogs = rounds[currentRoundId] || [];
                if (currentLogs.length === 0) return;
                
                scrubber.max = currentLogs.length - 1;
                scrubber.value = currentEventIndex;
                
                const event = currentLogs[currentEventIndex];
                seqDisplay.textContent = 'Seq: ' + (event.sequenceNumber || 0);
                
                const currentLevel = event.currentLevel || (event.state ? event.state.currentLevel : '?');
                levelDisplay.textContent = 'Level: ' + currentLevel;

                // Reset Active States
                for(let i=0; i<4; i++) {
                    const container = document.getElementById('p-container-'+i);
                    if (container) container.classList.remove('active');
                }

                // Render Hands
                const players = event.hands ? Object.keys(event.hands) : [];
                players.forEach((pid, idx) => {
                    const handEl = document.getElementById('hand-' + idx);
                    const nameEl = document.getElementById('p-name-' + idx);
                    const container = document.getElementById('p-container-' + idx);
                    
                    if (handEl) {
                        const isCurrentTurn = event.state && event.state.turn === idx;
                        if (isCurrentTurn) container.classList.add('active');

                        const sortedHand = sortCards(event.hands[pid] || [], currentLevel);
                        nameEl.textContent = pid + ' (' + sortedHand.length + ')';
                        handEl.innerHTML = sortedHand.map(c => renderCard(c, currentLevel)).join('');
                    }
                });
                
                // Render Center Event
                const titleEl = document.getElementById('event-title');
                const detailsEl = document.getElementById('event-details');
                const centerCardsEl = document.getElementById('center-cards');
                const statusEl = document.getElementById('play-status');

                const displayName = event.displayName || 'EVENT';
                titleEl.textContent = displayName.replace(/_/g, ' ').toUpperCase();
                
                let details = (event.playerId || event.playerName || event.player || 'System');
                if (displayName === 'bot_play' || displayName === 'play' || displayName === 'PLAYING') {
                    if (event.type === 'PASS' || (event.cardIndices && event.cardIndices.length === 0)) {
                        titleEl.textContent = 'PASS';
                        titleEl.style.color = '#ccc';
                    } else {
                        titleEl.style.color = '#ffeb3b';
                    }
                }

                detailsEl.textContent = details;
                
                // Handle Center Cards
                let cardsToDisplay = event.resolvedCards || [];
                let label = "Current Lead";

                if (cardsToDisplay.length > 0) {
                    label = "Played This Turn";
                } else if (event.state && event.state.lastPlay) {
                    cardsToDisplay = event.state.lastPlay.cards;
                    label = "Last Play to Beat";
                }

                statusEl.textContent = label;
                centerCardsEl.innerHTML = cardsToDisplay.map(c => renderCard(c, currentLevel)).join('');
                
                // Handle Tributes
                if (displayName.includes('TRIBUTE')) {
                     titleEl.innerHTML += displayName.includes('RETURN') ? 
                        '<span class="tribute-badge tribute-return">RETURN</span>' : 
                        '<span class="tribute-badge tribute-give">TRIBUTE</span>';
                }

                // Update Log Terminal
                const logEl = document.getElementById('event-log');
                logEl.innerHTML = currentLogs.slice(0, currentEventIndex + 1).map(e => {
                    const isAgent = e.source && e.source.startsWith('AGENT');
                    const sourceClass = isAgent ? 'log-agent' : 'log-server';
                    let logStr = '<div class="log-entry">[' + new Date(e.timestamp).toLocaleTimeString() + '] ';
                    logStr += '<span class="' + sourceClass + '">[' + (e.source || 'SYS') + ']</span> ';
                    logStr += '<strong>' + (e.displayName || 'EVENT') + '</strong> ' + (e.playerId || e.playerName || '');
                    
                    if (e.decision && e.decision.reasoning) {
                        logStr += ' <i style="color: #888; font-size: 0.9em;">(Reasoning: ' + e.decision.reasoning.substring(0, 100) + '...)</i>';
                    }
                    logStr += '</div>';
                    return logStr;
                }).reverse().join('');
            }
            
            roundSelect.addEventListener('change', (e) => {
                currentRoundId = e.target.value;
                currentEventIndex = 0;
                updateUI();
            });
            
            scrubber.addEventListener('input', (e) => {
                currentEventIndex = parseInt(e.target.value);
                updateUI();
            });
            
            prevBtn.addEventListener('click', () => {
                if (currentEventIndex > 0) { currentEventIndex--; updateUI(); }
            });
            
            nextBtn.addEventListener('click', () => {
                if (currentEventIndex < (rounds[currentRoundId] || []).length - 1) { currentEventIndex++; updateUI(); }
            });
            
            updateUI();
        }
    </script>
</body>
</html>
`;

fs.writeFileSync(outputFile, htmlContent);
console.log('✅ Generated fixed playback page at ' + outputFile);
