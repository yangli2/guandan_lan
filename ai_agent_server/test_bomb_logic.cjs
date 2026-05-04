const { generatePossiblePlays } = require('./move_generator.js');
const engine = require('../server/logic/engine.js');

const hand = [
    { suit: 'H', rank: '3' },
    { suit: 'S', rank: '5' },
    { suit: 'D', rank: '7' },
    { suit: 'C', rank: '9' },
    { suit: 'H', rank: 'J' },
];

const currentLevel = '2';
// 4 4s
const currentPlay = {
    type: 'BOMB',
    value: 7, // Rank 4 value
    size: 4
};

console.log('Testing generatePossiblePlays against 4 4s Bomb...');
const plays = generatePossiblePlays(hand, currentLevel, currentPlay);
console.log('Number of plays found:', plays.length);
if (plays.length > 0) {
    console.log('Top play:', JSON.stringify(plays[0], null, 2));
} else {
    console.log('No legal plays found. Correct.');
}
