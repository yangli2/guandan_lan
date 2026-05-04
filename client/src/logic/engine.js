import { RANKS, JOKERS, COMBO_TYPES } from './constants.js';

/**
 * Guandan Engine
 */

function getCardRankValue(rank, currentLevel) {
    if (rank === 'BJ') return 20; // Big Joker
    if (rank === 'SJ') return 19; // Small Joker
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
    
    // Ensure currentLevel is string for comparison
    const levelStr = String(currentLevel);
    if (rank === levelStr) return 18; // Level Card
    
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
        const naturalFreqs = {};
        for (let rank in freqs) {
            naturalFreqs[getNaturalRankValue(rank)] = freqs[rank];
        }

        // Straight (5 cards)
        if (n === 5) {
            const isSameSuit = normalCards.length > 0 && normalCards.every(c => c.suit === normalCards[0].suit);
            const res = findBestConsecutive(naturalFreqs, wildCount, 5, 1);
            if (res) {
                if (isSameSuit && (wildCount === 0 || cards.some(c => isWildCard(c, currentLevel)))) { 
                    return { type: COMBO_TYPES.STRAIGHT_FLUSH, value: res.highestRank };
                }
                return { type: COMBO_TYPES.STRAIGHT, value: res.highestRank };
            }
        }

        // Tube (Consecutive pairs, 3+ pairs)
        if (n >= 6 && n % 2 === 0) {
           const pairsCount = n / 2;
           const res = findBestConsecutive(naturalFreqs, wildCount, pairsCount, 2);
           if (res) {
               return { type: COMBO_TYPES.TUBE, value: res.highestRank, size: n };
           }
        }

        // Plate (Steel Plate, exactly 2 consecutive triples = 6 cards)
        if (n === 6) {
            const res = findBestConsecutive(naturalFreqs, wildCount, 2, 3);
            if (res) {
                return { type: COMBO_TYPES.PLATE, value: res.highestRank };
            }
        }
    }

    return null;
}

/**
 * Finds if a consecutive sequence can be formed and returns its highest rank.
 */
function findBestConsecutive(freqs, wildCount, length, countPerRank) {
    const checkRange = (start) => {
        let neededWilds = 0;
        for (let i = 0; i < length; i++) {
            let currentVal = start + i;
            if (currentVal === 1) currentVal = 14; // 'A'
            const currentFreq = freqs[currentVal] || 0;
            if (currentFreq < countPerRank) {
                neededWilds += (countPerRank - currentFreq);
            }
        }
        return neededWilds <= wildCount;
    };

    // Standard straights (up to 10-J-Q-K-A)
    for (let start = 14 - length + 1; start >= 2; start--) {
        if (checkRange(start)) {
            return { highestRank: start + length - 1 };
        }
    }

    // Special case A-2-3-4-5 (highest card is 5)
    if (checkRange(1)) {
        return { highestRank: 5 };
    }

    return null;
}

function checkConsecutive(freqs, wildCount, length, countPerRank) {
    return !!findBestConsecutive(freqs, wildCount, length, countPerRank);
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

export {
    getCardRankValue,
    isWildCard,
    sortCards,
    analyzeCombo,
    compareCombos
};
