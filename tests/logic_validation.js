const Game = require('../server/logic/game');
const { analyzeCombo } = require('../server/logic/engine');

async function runTests() {
    console.log("--- Starting Guandan Logic Validation ---\n");

    // 1. Combo Detection Validation (Steel Plate & Tube)
    console.log("TEST 1: Combo Detection");
    const tubeCards = [
        { suit: 'H', rank: '3' }, { suit: 'S', rank: '3' },
        { suit: 'H', rank: '4' }, { suit: 'S', rank: '4' },
        { suit: 'H', rank: '5' }, { suit: 'S', rank: '5' }
    ];
    const tube = analyzeCombo(tubeCards, '2');
    console.log("3 pairs (Tube) detected:", tube?.type === 'TUBE' ? '✅ PASS' : '❌ FAIL');

    const plateCards = [
        { suit: 'H', rank: '3' }, { suit: 'S', rank: '3' }, { suit: 'C', rank: '3' },
        { suit: 'H', rank: '4' }, { suit: 'S', rank: '4' }, { suit: 'C', rank: '4' }
    ];
    const plate = analyzeCombo(plateCards, '2');
    console.log("2 triples (Steel Plate) detected:", plate?.type === 'PLATE' ? '✅ PASS' : '❌ FAIL');

    // 2. Double Win (Du) Rule
    console.log("\nTEST 2: Double Win Rule");
    const game = new Game('test-room');
    game.join({ id: 'p1', name: 'Player 1' });
    game.join({ id: 'p2', name: 'Player 2' });
    game.join({ id: 'p3', name: 'Player 3' });
    game.join({ id: 'p4', name: 'Player 4' });
    game.state = 'PLAYING';
    
    // Simulate Team 0 (p1, p3) taking 1st and 2nd
    console.log("Setting up double win scenario...");
    // Give everyone some cards to prevent infinite loops in nextTurn
    game.players.forEach(p => p.hand = [{suit: 'S', rank: '2'}]);
    
    game.winners = ['p1'];
    game.players[0].hand = []; // p1 already finished
    game.players[2].hand = [{suit: 'S', rank: 'A'}]; // p3 has 1 card left
    game.turn = 2; // p3 turn
    console.log("Calling game.play('p3', [0])...");
    game.play('p3', [0]); // p3 plays last card
    console.log("game.play('p3', [0]) finished.");
    
    console.log("Game state after p1, p3 win:", game.state);
    console.log("Is finished?", game.state === 'FINISHED' ? '✅ PASS' : '❌ FAIL');
    console.log("Winners list length (should be 4):", game.winners.length);

    // 3. Tribute Return Logic
    console.log("\nTEST 3: Tribute Return Logic");
    const tGame = new Game('tribute-room');
    tGame.players = [
        { id: 'p1', name: 'P1', team: 0, hand: [{suit:'H', rank:'10'}] },
        { id: 'p2', name: 'P2', team: 1, hand: [{suit:'S', rank:'3'}] },
        { id: 'p3', name: 'P3', team: 0, hand: [{suit:'D', rank:'3'}] },
        { id: 'p4', name: 'P4', team: 1, hand: [{suit:'C', rank:'3'}] }
    ];
    tGame.state = 'RETURN_TRIBUTE';
    tGame.tributeInfo = {
        tributes: [{ from: tGame.players[1], to: tGame.players[0] }],
        returns: [],
        history: []
    };
    
    const returnResult = tGame.returnTribute('p1', 0);
    console.log("Return action success?", returnResult.success ? '✅ PASS' : '❌ FAIL');
    console.log("New game state after return:", tGame.state);
    console.log("State moved to PLAYING?", tGame.state === 'PLAYING' ? '✅ PASS' : '❌ FAIL');
    console.log("Card transferred to loser?", tGame.players[1].hand.some(c => c.rank === '10') ? '✅ PASS' : '❌ FAIL');

    console.log("\n--- Logic Validation Complete ---");
    process.exit(0);
}

runTests().catch(err => {
    console.error("TEST HUNG OR FAILED:", err);
    process.exit(1);
});
