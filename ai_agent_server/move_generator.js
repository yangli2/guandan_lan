import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const engine = require('../server/logic/engine.js');

export function generatePossiblePlays(hand, currentLevel, currentPlay) {
    const validPlays = [];
    const seenCombos = new Set();
    const wildCount = hand.filter(c => engine.isWildCard(c, currentLevel)).length;
    const wildIndices = hand.map((c, i) => engine.isWildCard(c, currentLevel) ? i : -1).filter(i => i !== -1);
    const normalCards = hand.map((c, i) => ({ ...c, originalIndex: i })).filter((c, i) => !engine.isWildCard(c, currentLevel));

    function addPlay(indices, combo) {
        if (!combo) return;
        const cards = indices.map(i => hand[i]);
        // Unique signature to avoid duplicate structural plays
        const sig = `${combo.type}:${combo.value}:${combo.size || 0}:${cards.map(c => c.rank + c.suit).sort().join(',')}`;
        if (seenCombos.has(sig)) return;
        seenCombos.add(sig);

        if (!currentPlay || engine.compareCombos(currentPlay, combo)) {
            validPlays.push({
                indices: [...indices],
                combo: combo,
                cards: cards
            });
        }
    }

    // 1. Group by rank
    const rankMap = {};
    normalCards.forEach(c => {
        if (!rankMap[c.rank]) rankMap[c.rank] = [];
        rankMap[c.rank].push(c.originalIndex);
    });

    // 2. Singles, Pairs, Triples, Bombs (from same rank)
    const allRanks = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', 'SJ', 'BJ'];
    allRanks.forEach(rank => {
        const indices = rankMap[rank] || [];
        const count = indices.length;
        
        // Singles
        if (count >= 1) addPlay([indices[0]], { type: 'SINGLE', value: engine.getCardRankValue(rank, currentLevel) });
        
        // Pairs
        if (count >= 2) addPlay(indices.slice(0, 2), { type: 'PAIR', value: engine.getCardRankValue(rank, currentLevel) });
        if (count === 1 && wildCount >= 1 && rank !== 'SJ' && rank !== 'BJ') {
            addPlay([indices[0], wildIndices[0]], { type: 'PAIR', value: engine.getCardRankValue(rank, currentLevel) });
        }
        
        // Triples
        if (count >= 3) addPlay(indices.slice(0, 3), { type: 'TRIPLE', value: engine.getCardRankValue(rank, currentLevel) });
        if (count >= 1 && rank !== 'SJ' && rank !== 'BJ') {
            if (count === 2 && wildCount >= 1) addPlay([...indices.slice(0, 2), wildIndices[0]], { type: 'TRIPLE', value: engine.getCardRankValue(rank, currentLevel) });
            if (count === 1 && wildCount >= 2) addPlay([indices[0], ...wildIndices.slice(0, 2)], { type: 'TRIPLE', value: engine.getCardRankValue(rank, currentLevel) });
        }

        // Bombs
        for (let size = 4; size <= 8; size++) {
            if (rank === 'SJ' || rank === 'BJ') continue;
            const neededWilds = size - count;
            if (neededWilds >= 0 && neededWilds <= wildCount) {
                addPlay([...indices, ...wildIndices.slice(0, neededWilds)], { type: 'BOMB', value: engine.getCardRankValue(rank, currentLevel), size });
            }
        }
    });

    // All-wild bombs
    for (let size = 4; size <= Math.min(8, wildCount); size++) {
        addPlay(wildIndices.slice(0, size), { type: 'BOMB', value: engine.getCardRankValue(currentLevel, currentLevel), size });
    }

    // Four Jokers
    const jokers = hand.map((c, i) => (c.rank === 'SJ' || c.rank === 'BJ') ? i : -1).filter(i => i !== -1);
    if (jokers.length === 4) {
        addPlay(jokers, { type: 'FOUR_JOKERS', value: 1000 });
    }

    // 3. Full Houses (Triple + Pair)
    const triples = [];
    const pairs = [];
    
    // Collect all possible triples and pairs (including wildcard ones)
    // To avoid O(N^2), we just use the ones we found
    validPlays.forEach(p => {
        if (p.combo.type === 'TRIPLE') triples.push(p);
        if (p.combo.type === 'PAIR') pairs.push(p);
    });

    triples.forEach(t => {
        pairs.forEach(p => {
            // Check if they share indices
            const intersection = t.indices.filter(idx => p.indices.includes(idx));
            if (intersection.length === 0) {
                addPlay([...t.indices, ...p.indices], { type: 'FULL_HOUSE', value: t.combo.value });
            }
        });
    });

    // 4. Straights, Straight Flushes (Exactly 5 cards)
    const suits = ['H', 'D', 'C', 'S'];
    const naturalRankValues = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 2-A
    
    function findSequences(suitFilter = null) {
        const available = {}; // naturalRank -> [indices]
        normalCards.forEach(c => {
            if (suitFilter && c.suit !== suitFilter) return;
            const val = engine.getNaturalRankValue(c.rank);
            if (!available[val]) available[val] = [];
            available[val].push(c.originalIndex);
        });

        const checkRange = (start, length, countPerRank) => {
            const combinedIndices = [];
            let neededWilds = 0;
            for (let i = 0; i < length; i++) {
                let rankVal = start + i;
                if (rankVal === 1) rankVal = 14; // 'A'
                const currentIndices = available[rankVal] || [];
                if (currentIndices.length < countPerRank) {
                    neededWilds += (countPerRank - currentIndices.length);
                    combinedIndices.push(...currentIndices);
                } else {
                    combinedIndices.push(...currentIndices.slice(0, countPerRank));
                }
            }
            if (neededWilds <= wildCount) {
                // Add remaining wilds
                const usedWilds = wildIndices.filter(idx => !combinedIndices.includes(idx)).slice(0, neededWilds);
                if (usedWilds.length === neededWilds) {
                    return [...combinedIndices, ...usedWilds];
                }
            }
            return null;
        };
        return { checkRange };
    }

    // Run sequence discovery
    const normalSeq = findSequences(null);
    // Straights (5)
    for (let start = 1; start <= 10; start++) {
        const res = normalSeq.checkRange(start, 5, 1);
        if (res) addPlay(res, { type: 'STRAIGHT', value: start === 1 ? 5 : start + 4 });
    }
    // Tubes (3+ pairs)
    for (let len = 3; len <= 5; len++) {
        for (let start = 2; start <= 14 - len + 1; start++) {
            const res = normalSeq.checkRange(start, len, 2);
            if (res) addPlay(res, { type: 'TUBE', value: start + len - 1, size: len * 2 });
        }
    }
    // Plates (2 consecutive triples)
    for (let start = 2; start <= 13; start++) {
        const res = normalSeq.checkRange(start, 2, 3);
        if (res) addPlay(res, { type: 'PLATE', value: start + 1 });
    }

    // Straight Flushes
    suits.forEach(suit => {
        const suitSeq = findSequences(suit);
        for (let start = 1; start <= 10; start++) {
            const res = suitSeq.checkRange(start, 5, 1);
            if (res) {
                addPlay(res, { type: 'STRAIGHT_FLUSH', value: start === 1 ? 5 : start + 4 });
            }
        }
    });

    // 5. Score and Sort
    validPlays.forEach(play => {
        const isBomb = play.combo.type === 'BOMB' || play.combo.type === 'STRAIGHT_FLUSH' || play.combo.type === 'FOUR_JOKERS' ? 1 : 0;
        const numCards = play.cards.length;
        const totalValue = play.cards.reduce((sum, c) => sum + (engine.getCardRankValue(c.rank, currentLevel) - 2), 0);
        
        // Strategy: prefer clearing many cards, prefer keeping bombs
        play.score = (isBomb * -1000) + (numCards * 100) - totalValue;
    });

    validPlays.sort((a, b) => b.score - a.score);

    return validPlays;
}
