import { initAgent, decideMove } from './agent.js';
import config from './config.js';

async function verify() {
    const { client, guandanSkill } = await initAgent();
    
    // Create a real session
    const sessionRes = await client.session.create({
        body: { 
            title: 'Verification Session',
            permission: [
                { permission: "bash", pattern: "*", action: "allow" },
                { permission: "read", pattern: "*", action: "allow" },
                { permission: "edit", pattern: "*", action: "allow" },
                { permission: "list", pattern: "*", action: "allow" }
            ]
        }
    });
    const sessionId = sessionRes.data.id;
    console.log(`Test Session Created: ${sessionId}`);

    const mockGameState = {
        players: [
            { id: 'p1', name: 'Alice', team: 0 },
            { id: 'p2', name: 'Bob', team: 1 },
            { id: 'p3', name: 'Charlie', team: 0 },
            { id: 'p4', name: 'David', team: 1 }
        ],
        turn: 0,
        currentLevel: '2',
        state: 'PLAYING',
        lastPlay: null
    };

    const mockHand = [
        { suit: 'H', rank: 'A', value: 14 },
        { suit: 'S', rank: 'A', value: 14 },
        { suit: 'D', rank: 'K', value: 13 },
        { suit: 'C', rank: 'K', value: 13 }
    ];

    const possiblePlays = "Possible plays: [[0, 1], [2, 3], [0], [1], [2], [3]]";

    console.log('--- STARTING AGENTIC MOVE DECISION ---');
    try {
        const move = await decideMove(client, sessionId, mockGameState, mockHand, null, possiblePlays);
        console.log('--- FINAL MOVE RECEIVED ---');
        console.log(JSON.stringify(move, null, 2));
    } catch (e) {
        console.error('Test Failed:', e);
    }
}

verify().catch(console.error);
