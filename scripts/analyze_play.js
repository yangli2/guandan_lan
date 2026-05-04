
const fs = require('fs');
const path = require('path');

const logDir = path.join('logs', 'split');
const files = fs.readdirSync(logDir).filter(f => f.endsWith('.json'));

// Filter for substantial games (> 50 entries)
const targetFiles = files.filter(f => {
    const content = JSON.parse(fs.readFileSync(path.join(logDir, f), 'utf8'));
    return content.length > 50;
});

console.log(`Analyzing ${targetFiles.length} games...`);

const report = {
    games: [],
    overallCritique: {
        strengths: [],
        weaknesses: [],
        recommendations: []
    }
};

targetFiles.forEach(file => {
    const logs = JSON.parse(fs.readFileSync(path.join(logDir, file), 'utf8'));
    const gameId = file.replace('.json', '');
    
    const gameStats = {
        id: gameId,
        botActions: {}, // botId -> { plays: [], reasoning: [] }
        summary: ""
    };

    logs.forEach(log => {
        const botId = log.playerId || (log.source.startsWith('AGENT-') ? log.source : null);
        if (!botId) return;

        if (!gameStats.botActions[botId]) {
            gameStats.botActions[botId] = { plays: [], reasoning: [] };
        }

        if (log.decision) {
            gameStats.botActions[botId].reasoning.push(log.decision.reasoning);
        }
        if (log.displayName === 'bot_play' || log.displayName === 'play') {
            gameStats.botActions[botId].plays.push(log);
        }
    });

    report.games.push(gameStats);
});

// Output a raw structure for the agent to synthesize
console.log(JSON.stringify(report, null, 2));
