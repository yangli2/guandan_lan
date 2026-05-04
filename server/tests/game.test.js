jest.mock('uuid', () => ({
    v4: () => 'mock-uuid'
}));

const Game = require('../logic/game');

describe('Game Logic', () => {
    let game;

    beforeEach(() => {
        game = new Game('test-room');
    });

    test('Player joining', () => {
        expect(game.join({ id: 'p1', name: 'Alice' })).toBe(true);
        expect(game.players.length).toBe(1);
        expect(game.players[0].team).toBe(0);

        game.join({ id: 'p2', name: 'Bob' });
        expect(game.players[1].team).toBe(1);

        game.join({ id: 'p3', name: 'Charlie' });
        expect(game.players[2].team).toBe(0);

        game.join({ id: 'p4', name: 'David' });
        expect(game.join({ id: 'p5', name: 'Eve' })).toBe(false);
    });


    test('Game start and dealing', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));

        expect(game.start()).toBe(true);
        expect(game.state).toBe('PLAYING');
        game.players.forEach(p => {
            expect(p.hand.length).toBe(27);
        });
    });

    test('Turn management and passing', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        game.start();

        expect(game.turn).toBe(0);
        
        // Player 0 passes
        const res = game.play('p1', []);
        expect(res.success).toBe(true);
        expect(game.turn).toBe(1);
        
        // Wrong player attempts to play
        const resWrong = game.play('p1', [0]);
        expect(resWrong.error).toBe("Not your turn");
    });

    test('Playing a single card', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        game.start();

        // Ensure Player 0 has a card at index 0
        const initialHandSize = game.players[0].hand.length;
        const res = game.play('p1', [0]);
        expect(res.success).toBe(true);
        expect(game.players[0].hand.length).toBe(initialHandSize - 1);
        expect(game.lastPlay.playerId).toBe('p1');
        expect(game.turn).toBe(1);
    });

    test('Winning a round (Early finish)', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        game.start();

        // Cheat: empty hands
        game.players[0].hand = [{ rank: '3' }];
        game.players[2].hand = [{ rank: '4' }]; // Higher to beat teammate

        // Player 0 finishes
        game.play('p1', [0]);
        expect(game.winners).toContain('p1');
        expect(game.winners.length).toBe(1);

        // Player 2 finishes (Double win)
        game.turn = 2;
        game.play('p3', [0]);
        expect(game.winners).toContain('p3');
        expect(game.state).toBe('FINISHED');
        expect(game.winners.length).toBe(4); // Double win auto-fills
    });

    test('Tribute phase setup', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        
        // Set previous winners for tribute (Double Win for Team 0)
        game.winners = ['p1', 'p3', 'p2', 'p4'];
        game.start(); // Next round starts tribute

        expect(game.state).toBe('RETURN_TRIBUTE');
        expect(game.tributeInfo.tributes.length).toBe(2);
        
        // Verify hands sizes after tribute
        const p1 = game.players.find(p => p.id === 'p1');
        const p4 = game.players.find(p => p.id === 'p4');
        expect(p1.hand.length).toBe(28); // Received tribute
        expect(p4.hand.length).toBe(26); // Gave tribute
    });

    test('Resistance (Jokers) cancels tribute', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        
        // Force winners
        game.winners = ['p1', 'p2', 'p3', 'p4'];
        
        // Cheat to force 2 Big Jokers in last player's hand
        game.deal = jest.fn().mockImplementation(() => {
            game.players.forEach(p => p.hand = Array(27).fill({ rank: '3' }));
            game.players[3].hand[0] = { rank: 'BJ' };
            game.players[3].hand[1] = { rank: 'BJ' };
        });

        game.start();
        expect(game.state).toBe('PLAYING'); // Skipped tribute
        expect(game.log).toEqual(expect.arrayContaining([expect.stringContaining("RESISTANCE")]));
    });

    test('Skipping multiple players with no cards', () => {
        const players = [
            { id: 'p1', name: 'A' }, { id: 'p2', name: 'B' },
            { id: 'p3', name: 'C' }, { id: 'p4', name: 'D' }
        ];
        players.forEach(p => game.join(p));
        game.start();

        // Cheat: Players 1 and 2 have no cards
        game.players[1].hand = [];
        game.players[2].hand = [];

        // Player 0 plays
        game.play('p1', [0]);
        // Turn should skip 1 and 2, go to 3
        expect(game.turn).toBe(3);
    });
});
