
const rankMap = { 'A': 17, 'K': 16, 'Q': 15, 'J': 14, '10': 13, '9': 12, '8': 11, '7': 10, '6': 9, '5': 8, '4': 7, '3': 6, '2': 5 };

function getCardValue(rank, level) {
    if (rank === 'BJ') return 20;
    if (rank === 'SJ') return 19;
    if (String(rank) === String(level)) return 18;
    return rankMap[rank] || 0;
}

function sortHand(hand, level) {
    if (!hand) return [];
    return [...hand].sort((a, b) => {
        const vA = getCardValue(a.rank, level);
        const vB = getCardValue(b.rank, level);
        if (vA !== vB) return vB - vA;
        return (a.suit || '').localeCompare(b.suit || '');
    });
}

function processLogs(logs) {
    const rounds = {};
    logs.forEach(log => {
        if (log.roundId && log.roundId !== 'unknown') {
            if (!rounds[log.roundId]) rounds[log.roundId] = [];
            rounds[log.roundId].push(log);
        }
    });

    const processedRounds = {};

    Object.entries(rounds).forEach(([roundId, roundLogs]) => {
        const sequences = {};
        roundLogs.forEach(log => {
            const seq = log.sequenceNumber || 0;
            if (!sequences[seq]) sequences[seq] = [];
            sequences[seq].push(log);
        });

        let handHistory = {}; // This will always hold the state at the END of the previous sequence
        let currentLevel = '2';
        const finalLogs = [];
        const playerMap = {};

        const sortedSeqs = Object.keys(sequences).map(Number).sort((a, b) => a - b);
        
        sortedSeqs.forEach(seq => {
            const seqLogs = sequences[seq];
            
            // 1. Resolve moves in this sequence based on the PREVIOUS sequence's hand state
            seqLogs.forEach(log => {
                const pid = log.playerId || playerMap[log.source];
                
                // Priority 1: Use explicit cards if already resolved in the log (new format)
                if (log.cards || log.playedCards) {
                    log.resolvedCards = log.cards || log.playedCards;
                    return;
                }

                // Priority 2: Resolve indices against hand history (backward compatibility)
                if (log.cardIndices && pid && handHistory[pid]) {
                    log.resolvedCards = log.cardIndices.map(idx => handHistory[pid][idx]).filter(Boolean);
                }
            });

            // 2. Update state for the NEXT sequence based on current sequence's ground truth
            seqLogs.forEach(log => {
                if (log.currentLevel) currentLevel = log.currentLevel;
                if (log.state && log.state.currentLevel) currentLevel = log.state.currentLevel;
                
                // Prioritize plural 'hands' (full state) over singular 'hand'
                if (log.hands) {
                    handHistory = JSON.parse(JSON.stringify(log.hands));
                } else if (log.hand && log.playerId) {
                    handHistory[log.playerId] = JSON.parse(JSON.stringify(log.hand));
                }
                
                // Map AGENT source to playerId for future lookups
                if (log.source && log.source.startsWith('AGENT-')) {
                    const agentName = log.source.replace('AGENT-', '');
                    if (!playerMap[log.source]) {
                        if (log.state && log.state.players) {
                            const p = log.state.players.find(p => p.name === agentName);
                            if (p) playerMap[log.source] = p.id;
                        }
                    }
                }
            });

            // 3. Persist current sequence's findings and the NEW hand state for rendering
            seqLogs.forEach(log => {
                log.currentLevel = currentLevel;
                log.displayName = log.event || (typeof log.state === 'string' ? log.state : (log.state && log.state.state) || null) || 'UNKNOWN_EVENT';
                log.hands = JSON.parse(JSON.stringify(handHistory));
                finalLogs.push(log);
            });
        });

        processedRounds[roundId] = finalLogs;
    });

    return processedRounds;
}

module.exports = {
    processLogs,
    sortHand,
    getCardValue
};
