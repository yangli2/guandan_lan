const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const isLatest = args.includes('--latest');
const positionalArgs = args.filter(a => !a.startsWith('--'));

if (positionalArgs.length < 3) {
    console.error("Usage: node join_logs.js [--latest] <server_log_dir> <agent_log_dir> <output_file>");
    process.exit(1);
}

const serverLogDir = positionalArgs[0];
const agentLogDir = positionalArgs[1];
const outputFile = positionalArgs[2];

let combinedLogs = [];

// 1. Read Server Logs
if (fs.existsSync(serverLogDir)) {
    const files = fs.readdirSync(serverLogDir).filter(f => f.startsWith('session_') && f.endsWith('.json'));
    for (const file of files) {
        const filePath = path.join(serverLogDir, file);
        try {
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (Array.isArray(data)) {
                data.forEach(entry => {
                    combinedLogs.push({ source: 'SERVER', ...entry });
                });
            }
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }
}

// 2. Read Agent Logs
if (fs.existsSync(agentLogDir)) {
    const files = fs.readdirSync(agentLogDir).filter(f => f.endsWith('_log.jsonl'));
    for (const file of files) {
        // Extract player name: format is <ROOM_ID>_<PLAYER_NAME>_log.jsonl
        const parts = file.split('_');
        const playerName = parts.length >= 3 ? parts[parts.length - 2] : file.replace('.jsonl', '');
        
        const filePath = path.join(agentLogDir, file);
        try {
            const lines = fs.readFileSync(filePath, 'utf8').split('\n');
            lines.forEach(line => {
                if (line.trim()) {
                    try {
                        const entry = JSON.parse(line);
                        combinedLogs.push({ source: `AGENT-${playerName}`, ...entry });
                    } catch(e) {}
                }
            });
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    }
}

// 3. Extract Latest Game (if requested)
if (isLatest && combinedLogs.length > 0) {
    // Find chronologically latest entry to determine the latest roundId
    let latestEntry = combinedLogs.reduce((latest, current) => {
        return new Date(current.timestamp).getTime() > new Date(latest.timestamp).getTime() ? current : latest;
    });
    const latestRoundId = latestEntry.roundId;
    combinedLogs = combinedLogs.filter(log => log.roundId === latestRoundId);
    console.log(`Filtered to latest roundId: ${latestRoundId}`);
}

// 4. Sort Logs
// Since an agent acts on state N and then the server records event N+1,
// sorting by sequenceNumber naturally interleaves them correctly.
combinedLogs.sort((a, b) => {
    if (a.roundId !== b.roundId) {
        // Different rounds: group by round ID lexicographically
        return (a.roundId || '').localeCompare(b.roundId || '');
    }
    
    // Same round: sort by sequence number
    const seqA = a.sequenceNumber || 0;
    const seqB = b.sequenceNumber || 0;
    
    if (seqA !== seqB) {
        return seqA - seqB;
    }
    
    // Tiebreaker: timestamp
    const timeA = new Date(a.timestamp).getTime();
    const timeB = new Date(b.timestamp).getTime();
    return timeA - timeB;
});

// 5. Output
fs.writeFileSync(outputFile, JSON.stringify(combinedLogs, null, 2));
console.log(`✅ Successfully merged ${combinedLogs.length} log entries into ${outputFile}`);
