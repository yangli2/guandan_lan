const { RANKS, JOKERS, COMBO_TYPES } = require('./constants');

/**
 * Guandan Engine
 */

function getCardRankValue(rank, currentLevel) {
    if (rank === 'BJ') return 20; // Big Joker
    if (rank === 'SJ') return 19; // Small Joker
    if (rank === currentLevel) return 18; // Level Card
    
    const rankMap = {
        'A': 17,
        'K': 16,
        'Q': 15,
        'J': 14,
        '10': 13,
        '9': 12,
        '8': 11,
        '7': 10,
        '6': 9,
        '5': 8,
        '4': 7,
        '3': 6,
        '2': 5
    };
    
    return rankMap[rank] || 0;
}

// Fixed numerical rank for sequences (ignoring level card priority)
function getNaturalRankValue(rank) {
    const rankMap = {
        '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };
    return rankMap[rank] || 0;
}

function isWildCard(card, currentLevel) {
    return card.suit === 'H' && card.rank === currentLevel;
}

function sortCards(cards, currentLevel) {
    return [...cards].sort((a, b) => {
        return getCardRankValue(b.rank, currentLevel) - getCardRankValue(a.rank, currentLevel);
    });
}

/**
 * Detects the strongest possible combination from a set of cards.
 * @param {Array} cards - Objects with {suit, rank}
 * @param {string} currentLevel - The rank of the current level card
 */
function analyzeCombo(cards, currentLevel) {
    if (!cards || cards.length === 0) return null;
    
    const n = cards.length;
    const wildCount = cards.filter(c => isWildCard(c, currentLevel)).length;
    const normalCards = cards.filter(c => !isWildCard(c, currentLevel));
    
    // Four Jokers (Heavenly Bomb)
    if (n === 4 && cards.filter(c => c.rank === 'BJ' || c.rank === 'SJ').length === 4) {
        return { type: COMBO_TYPES.FOUR_JOKERS, value: 1000 };
    }

    // Single
    if (n === 1) {
        return { type: COMBO_TYPES.SINGLE, value: getCardRankValue(cards[0].rank, currentLevel) };
    }

    // Helper: frequency map
    const freqs = {};
    normalCards.forEach(c => {
        freqs[c.rank] = (freqs[c.rank] || 0) + 1;
    });
    const distinctRanks = Object.keys(freqs);

    // Bomb (4+ cards of same rank)
    // In Guandan, a bomb is 4-8 cards.
    if (distinctRanks.length <= 1) {
        const rank = distinctRanks[0] || currentLevel; // if all are wild
        const total = (freqs[rank] || 0) + wildCount;
        if (total === n && n >= 4) {
            return { type: COMBO_TYPES.BOMB, value: getCardRankValue(rank, currentLevel), size: n };
        }
    }

    // Pair
    if (n === 2) {
        if (distinctRanks.length <= 1) {
             return { type: COMBO_TYPES.PAIR, value: getCardRankValue(distinctRanks[0] || currentLevel, currentLevel) };
        }
    }

    // Triple
    if (n === 3) {
        if (distinctRanks.length <= 1) {
            return { type: COMBO_TYPES.TRIPLE, value: getCardRankValue(distinctRanks[0] || currentLevel, currentLevel) };
        }
    }

    // Full House (3 + 2)
    if (n === 5) {
        // Try to form 3 + 2
        for (let rank of distinctRanks) {
            const needed = Math.max(0, 3 - freqs[rank]);
            if (wildCount >= needed) {
                const remainingWild = wildCount - needed;
                const otherRanks = distinctRanks.filter(r => r !== rank);
                if (otherRanks.length === 0) { // All cards same rank or wild
                    return { type: COMBO_TYPES.FULL_HOUSE, value: getCardRankValue(rank, currentLevel) };
                }
                if (otherRanks.length === 1) {
                    const otherRank = otherRanks[0];
                    if (freqs[otherRank] + remainingWild >= 2) {
                        return { type: COMBO_TYPES.FULL_HOUSE, value: getCardRankValue(rank, currentLevel) };
                    }
                }
            }
        }
    }

    // Multi-set analysis (Straights, Tubes, Plates)
    if (n >= 5) {
        // Use NATURAL values for sequence detection
        const naturalRanks = distinctRanks.map(r => getNaturalRankValue(r)).sort((a,b) => a-b);
        
        // Straight (5 cards)
        if (n === 5) {
            // Check for Straight Flush first
            const isSameSuit = normalCards.length > 0 && normalCards.every(c => c.suit === normalCards[0].suit);
            const canBeStraight = checkConsecutive(naturalRanks, wildCount, 5, 1);
            if (canBeStraight) {
                // Find natural value of the highest card in the straight
                const val = Math.max(...naturalRanks) + wildCount;
                if (isSameSuit && (wildCount === 0 || cards.some(c => isWildCard(c, currentLevel)))) { 
                    return { type: COMBO_TYPES.STRAIGHT_FLUSH, value: val };
                }
                return { type: COMBO_TYPES.STRAIGHT, value: val };
            }
        }

        // Tube (Consecutive pairs, 3+ pairs)
        if (n >= 6 && n % 2 === 0) {
           const pairsCount = n / 2;
           if (checkConsecutive(naturalRanks, wildCount, pairsCount, 2)) {
               return { type: COMBO_TYPES.TUBE, value: Math.max(...naturalRanks) + wildCount, size: n };
           }
        }

        // Plate (Steel Plate, exactly 2 consecutive triples = 6 cards)
        if (n === 6) {
            if (checkConsecutive(naturalRanks, wildCount, 2, 3)) {
                return { type: COMBO_TYPES.PLATE, value: Math.max(...naturalRanks) + wildCount };
            }
        }
    }

    return null;
}

function checkConsecutive(sortedRanks, wildCount, length, countPerRank) {
    // Guandan sequences: 2-3-4-5-6 up to 10-J-Q-K-A
    // Level cards and Jokers are generally NOT allowed in sequences.
    
    // Create a frequency map for quick lookup
    const freqs = {};
    sortedRanks.forEach(r => freqs[r] = (freqs[r] || 0) + 1);
    
    // Guandan sequences: 2-3-4-5-6 up to 10-J-Q-K-A
    // Rank values (natural) from 2 ('2') to 14 ('A')
    const minVal = 2; 
    const maxVal = 14;

    for (let start = minVal; start <= maxVal - length + 1; start++) {
        let neededWilds = 0;
        let possible = true;
        
        for (let i = 0; i < length; i++) {
            const currentVal = start + i;
            // Level cards are usually excluded from sequences in many rulesets, 
            // but for simplicity we allow them if the user hasn't specified otherwise.
            // HOWEVER, Jokers (19, 20) are definitely not allowed.
            if (currentVal >= 19) {
                possible = false;
                break;
            }

            const currentFreq = freqs[currentVal] || 0;
            if (currentFreq < countPerRank) {
                neededWilds += (countPerRank - currentFreq);
            }
        }

        if (possible && neededWilds <= wildCount) {
            // Check if we used too many cards (sum of freq in sequence + wilds must be total cards)
            // Actually n = length * countPerRank is already checked in the caller
            return true;
        }
    }
    return false;
}

function compareCombos(prev, current) {
    if (!current) return false;
    if (!prev) return true;

    // Joker Bomb beats everything
    if (current.type === COMBO_TYPES.FOUR_JOKERS) return true;
    if (prev.type === COMBO_TYPES.FOUR_JOKERS) return false;

    // Bomb rankings
    const isBomb = (t) => t === COMBO_TYPES.BOMB || t === COMBO_TYPES.STRAIGHT_FLUSH;
    
    if (isBomb(current.type)) {
        if (!isBomb(prev.type)) return true;
        
        // Bomb vs Bomb
        const currentPower = current.type === COMBO_TYPES.STRAIGHT_FLUSH ? 5.5 : (current.size || 0);
        const prevPower = prev.type === COMBO_TYPES.STRAIGHT_FLUSH ? 5.5 : (prev.size || 0);
        
        if (currentPower > prevPower) return true;
        if (currentPower < prevPower) return false;
        
        return current.value > prev.value;
    }

    // Normal sets
    if (current.type !== prev.type || current.size !== prev.size) return false;
    return current.value > prev.value;
}

module.exports = {
    getCardRankValue,
    isWildCard,
    sortCards,
    analyzeCombo,
    compareCombos
};
