const fs = require('fs');
const { processLogs } = require('./playback_logic');

const logs = JSON.parse(fs.readFileSync('combined_game_log.json', 'utf8'));
const processed = processLogs(logs);

Object.entries(processed).forEach(([roundId, roundLogs]) => {
    console.log(`\nROUND: ${roundId}`);
    roundLogs.forEach(log => {
        const sizes = Object.entries(log.hands || {}).map(([pid, h]) => `${pid}:${h.length}`).join(', ');
        const cards = log.resolvedCards ? log.resolvedCards.map(c => c.rank + c.suit).join(',') : 'none';
        console.log(`Seq ${log.sequenceNumber} | Event: ${log.displayName} | Player: ${log.playerId} | Cards: ${cards} | Sizes: ${sizes}`);
    });
});
