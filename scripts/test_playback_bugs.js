const { processLogs } = require('./playback_logic');
const assert = require('assert');

function testTributeBug() {
    console.log('Testing Tribute Bug (28/26 cards)...');
    
    // Scenario: Player 1 gives tribute to Player 2
    const hand1 = Array(27).fill({ rank: 'K', suit: 'H' });
    const hand2 = Array(27).fill({ rank: '3', suit: 'S' });
    
    const logs = [
        {
            roundId: 'round1',
            sequenceNumber: 1,
            source: 'SERVER',
            event: 'TRIBUTE_START',
            hands: { 'p1': [...hand1], 'p2': [...hand2], 'p3': [], 'p4': [] },
            currentLevel: '2'
        },
        {
            roundId: 'round1',
            sequenceNumber: 2,
            source: 'AGENT-p1',
            event: 'bot_tribute',
            playerId: 'p1',
            cardIndices: [0], // Give a King
            state: {
                tributes: [{ from: 'p1', to: 'p2', type: 'tribute' }]
            }
        }
    ];

    const processed = processLogs(logs);
    const round = processed['round1'];
    
    const lastEvent = round[round.length - 1];
    const p1HandSize = lastEvent.hands['p1'].length;
    const p2HandSize = lastEvent.hands['p2'].length;
    
    console.log(`P1 Hand Size: ${p1HandSize} (expected 26)`);
    console.log(`P2 Hand Size: ${p2HandSize} (expected 28)`);
    
    try {
        assert.strictEqual(p1HandSize, 26, 'P1 should have 26 cards after giving tribute');
        assert.strictEqual(p2HandSize, 28, 'P2 should have 28 cards after receiving tribute');
        console.log('✅ Tribute bug reproduction test passed (or rather, logic confirmed).');
    } catch (e) {
        console.error('❌ Tribute bug reproduction test failed:', e.message);
    }
}

function testDoubleRemovalBug() {
    console.log('\nTesting Double Removal Bug...');
    
    const hand = [
        { rank: '2', suit: 'H' },
        { rank: '3', suit: 'H' },
        { rank: '4', suit: 'H' }
    ];
    
    const logs = [
        {
            roundId: 'round1',
            sequenceNumber: 1,
            source: 'SERVER',
            hands: { 'p1': [...hand] },
            currentLevel: '2'
        },
        {
            roundId: 'round1',
            sequenceNumber: 2,
            source: 'AGENT-p1',
            event: 'bot_play',
            playerId: 'p1',
            cardIndices: [0], // Play '2H' (index 0 in sorted 2,3,4)
        },
        {
            roundId: 'round1',
            sequenceNumber: 2, // Same sequence as agent
            source: 'SERVER',
            event: 'play',
            playerId: 'p1',
            cardIndices: [0],
        }
    ];

    const processed = processLogs(logs);
    const round = processed['round1'];
    
    const lastEvent = round[round.length - 1];
    const p1HandSize = lastEvent.hands['p1'].length;
    
    console.log(`P1 Hand Size: ${p1HandSize} (expected 2)`);
    
    try {
        assert.strictEqual(p1HandSize, 2, 'P1 should have 2 cards after one play');
        console.log('✅ Double removal bug reproduction test passed (or logic confirmed).');
    } catch (e) {
        console.error('❌ Double removal bug reproduction test failed:', e.message);
    }
}

testTributeBug();
testDoubleRemovalBug();
