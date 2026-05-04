const { analyzeCombo, compareCombos, getCardRankValue } = require('../logic/engine');
const { COMBO_TYPES } = require('../logic/constants');

describe('Guandan Engine', () => {
    const level = '5';

    describe('getCardRankValue', () => {
        test('regular ranks', () => {
            expect(getCardRankValue('2', 'K')).toBe(5);
            expect(getCardRankValue('3', 'K')).toBe(6);
            expect(getCardRankValue('A', 'K')).toBe(17);
        });

        test('level card rank', () => {
            expect(getCardRankValue('K', 'K')).toBe(18);
            expect(getCardRankValue('5', '5')).toBe(18);
        });

        test('joker ranks', () => {
            expect(getCardRankValue('SJ', 'K')).toBe(19);
            expect(getCardRankValue('BJ', 'K')).toBe(20);
        });
    });

    describe('analyzeCombo', () => {
        test('Single', () => {
            const combo = analyzeCombo([{ suit: 'S', rank: '3' }], level);
            expect(combo.type).toBe(COMBO_TYPES.SINGLE);
            expect(combo.value).toBe(6);
        });

        test('Pair', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: '3' },
                { suit: 'H', rank: '3' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.PAIR);
            expect(combo.value).toBe(6);
        });

        test('Triple', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: '3' },
                { suit: 'H', rank: '3' },
                { suit: 'C', rank: '3' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.TRIPLE);
        });

        test('Bomb (4 cards)', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: '3' },
                { suit: 'H', rank: '3' },
                { suit: 'C', rank: '3' },
                { suit: 'D', rank: '3' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.BOMB);
            expect(combo.size).toBe(4);
        });

        test('Straight (5 cards)', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: '2' },
                { suit: 'H', rank: '3' },
                { suit: 'C', rank: '4' },
                { suit: 'D', rank: '5' },
                { suit: 'S', rank: '6' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.STRAIGHT);
            expect(combo.value).toBe(6);
        });

        test('A-2-3-4-5 Straight', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: 'A' },
                { suit: 'H', rank: '2' },
                { suit: 'C', rank: '3' },
                { suit: 'D', rank: '4' },
                { suit: 'S', rank: '5' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.STRAIGHT);
            expect(combo.value).toBe(5);
        });

        test('Full House', () => {
            const combo = analyzeCombo([
                { suit: 'S', rank: '3' },
                { suit: 'H', rank: '3' },
                { suit: 'C', rank: '3' },
                { suit: 'S', rank: '4' },
                { suit: 'H', rank: '4' }
            ], level);
            expect(combo.type).toBe(COMBO_TYPES.FULL_HOUSE);
            expect(combo.value).toBe(6);
        });

        test('Wildcard usage (Heart level card)', () => {
            // Level is 5. 5H is wildcard.
            const combo = analyzeCombo([
                { suit: 'S', rank: '3' },
                { suit: 'H', rank: '3' },
                { suit: 'H', rank: '5' } // Wildcard
            ], '5');
            expect(combo.type).toBe(COMBO_TYPES.TRIPLE);
            expect(combo.value).toBe(6);
        });
    });

    describe('compareCombos', () => {
        test('Higher single beats lower single', () => {
            const low = analyzeCombo([{ rank: '3' }], '5');
            const high = analyzeCombo([{ rank: '4' }], '5');
            expect(compareCombos(low, high)).toBe(true);
        });

        test('Level card beats Ace', () => {
            const ace = analyzeCombo([{ rank: 'A' }], '5');
            const levelCard = analyzeCombo([{ rank: '5' }], '5');
            expect(compareCombos(ace, levelCard)).toBe(true);
        });

        test('Bomb beats non-bomb', () => {
            const single = analyzeCombo([{ rank: 'BJ' }], '5');
            const bomb = analyzeCombo([
                { rank: '2' }, { rank: '2' }, { rank: '2' }, { rank: '2' }
            ], '5');
            expect(compareCombos(single, bomb)).toBe(true);
        });

        test('Larger bomb beats smaller bomb', () => {
            const bomb4 = analyzeCombo([
                { rank: 'A' }, { rank: 'A' }, { rank: 'A' }, { rank: 'A' }
            ], '5');
            const bomb5 = analyzeCombo([
                { rank: '2' }, { rank: '2' }, { rank: '2' }, { rank: '2' }, { rank: '2' }
            ], '5');
            expect(compareCombos(bomb4, bomb5)).toBe(true);
            expect(compareCombos(bomb5, bomb4)).toBe(false);
        });

        test('Same size bomb ranking', () => {
            const lowBomb = analyzeCombo([
                { rank: '3' }, { rank: '3' }, { rank: '3' }, { rank: '3' }
            ], '5');
            const highBomb = analyzeCombo([
                { rank: '4' }, { rank: '4' }, { rank: '4' }, { rank: '4' }
            ], '5');
            expect(compareCombos(lowBomb, highBomb)).toBe(true);
            expect(compareCombos(highBomb, lowBomb)).toBe(false);
        });

        test('Four Jokers beats everything', () => {
            const bomb8 = analyzeCombo([
                { rank: 'A' }, { rank: 'A' }, { rank: 'A' }, { rank: 'A' },
                { rank: 'A' }, { rank: 'A' }, { rank: 'A' }, { rank: 'A' }
            ], '5');
            const jokers = analyzeCombo([
                { rank: 'SJ' }, { rank: 'SJ' }, { rank: 'BJ' }, { rank: 'BJ' }
            ], '5');
            expect(compareCombos(bomb8, jokers)).toBe(true);
        });
    });
});
