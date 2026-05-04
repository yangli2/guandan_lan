import fs from 'fs';
import path from 'path';
import { initAgent, decideMove } from './agent.js';
import { joinGame, getGameState, playCards } from './tools.js';
import { generatePossiblePlays } from './move_generator.js';
import config from './config.js';

async function main() {
    const playerName = process.argv[2] || config.PLAYER_NAME;
    
    let logDir = null;
    const logDirIndex = process.argv.indexOf('--log-dir');
    if (logDirIndex !== -1 && process.argv[logDirIndex + 1]) {
        logDir = path.resolve(process.cwd(), process.argv[logDirIndex + 1]);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    const logFile = logDir ? path.join(logDir, `${config.ROOM_ID}_${playerName}_log.jsonl`) : null;

    console.log(`🚀 Starting AI Agent Server as ${playerName}...`);

    try {
        // 1. Join the Game
        const joinRes = await joinGame(playerName, config.ROOM_ID);
        if (!joinRes.success) {
            throw new Error(`Failed to join game: ${joinRes.error}`);
        }
        const { playerId } = joinRes;
        console.log(`✅ Joined room ${config.ROOM_ID} as ${playerName} (ID: ${playerId})`);

        // 2. Initialize Opencode Agent
        const { client, guandanSkill } = await initAgent();
        
        // 3. Create a session for this game
        const sessionResponse = await client.session.create({
            body: { 
                title: `Guandan Game - ${config.PLAYER_NAME}`,
                permission: [
                    { permission: "bash", pattern: "*", action: "allow" },
                    { permission: "read", pattern: "*", action: "allow" },
                    { permission: "edit", pattern: "*", action: "allow" },
                    { permission: "list", pattern: "*", action: "allow" }
                ]
            }
        });
        const sessionId = sessionResponse.data.id;
        console.log(`🤖 Opencode session created: ${sessionId}`);

        // 4. Start reasoning stream listener
        (async () => {
            try {
                const events = await client.event.subscribe();
                for await (const event of events.stream) {
                    if (event.properties?.sessionID === sessionId) {
                        if (event.type === 'reasoning') {
                            process.stdout.write(`\x1b[36m[Reasoning]\x1b[0m ${event.properties.text}\n`);
                        } else if (event.type === 'text') {
                            process.stdout.write(`\x1b[32m[Agent]\x1b[0m ${event.properties.text}\n`);
                        }
                    }
                }
            } catch (e) {
                console.error('❌ Event stream error:', e);
            }
        })();

        // 5. Inject the Guandan Skill as context
        await client.session.prompt({
            path: { id: sessionId },
            body: {
                noReply: true,
                parts: [{ type: 'text', text: `Here is your professional Guandan Skill guide:\n\n${guandanSkill}` }]
            }
        });
        console.log('📚 Guandan Skill injected into agent memory.');

        // 5. Game Loop
        console.log('🎮 Monitoring game state... (Ctrl+C to stop)');
        
        let lastError = null;

        while (true) {
            const stateData = await getGameState(playerId, config.ROOM_ID);
            if (stateData.error) {
                console.error(`❌ Error fetching state: ${stateData.error}`);
            } else {
                const { state, hand } = stateData;
                const turnPlayerId = state.players[state.turn]?.id;

                if (turnPlayerId === playerId && (state.state === 'PLAYING' || state.state === 'RETURN_TRIBUTE')) {
                    console.log('\n✨ It is your turn!');
                    
                    let possiblePlaysString = '';
                    let autoPass = false;
                    
                    if (state.state === 'PLAYING') {
                        const plays = generatePossiblePlays(hand, state.currentLevel, state.lastPlay?.combo);
                        if (state.lastPlay && plays.length === 0) {
                            console.log('⚠️ No legal plays available. Auto-passing to save API costs.');
                            autoPass = true;
                        } else {
                            const topPlays = plays.slice(0, 5);
                            let options = topPlays.map((p, idx) => {
                                const cardNames = p.cards.map(c => c.rank + c.suit).join(', ');
                                return `Option ${idx + 1}: Indices [${p.indices.join(', ')}] - Pattern: ${p.combo.type} (${cardNames})`;
                            });
                            let targetInfo = '';
                            if (state.lastPlay) {
                                const targetCards = state.lastPlay.cards.map(c => c.rank + c.suit).join(', ');
                                targetInfo = `The current table play is: ${state.lastPlay.combo.type} (${targetCards}). You MUST beat this or pass. `;
                            }
                            
                            possiblePlaysString = `\n[TOOL OUPUT] I have calculated your valid plays using the game engine. ${targetInfo}There are ${plays.length} possible valid plays you can make. `;
                            if (plays.length > 5) {
                                possiblePlaysString += `Here are the top 5 plays ranked by their ability to clear cards efficiently (excluding bombs unless necessary):\n${options.join('\n')}`;
                            } else if (plays.length > 0) {
                                possiblePlaysString += `Here are your only options:\n${options.join('\n')}`;
                            }
                            
                            if (plays.length > 5) {
                                possiblePlaysString += `\nNOTE: The tool selected these small tricks to help you clear cards quickly, but if there are other plays that are more strategically advantageous, you should definitely rely on your own professional judgement.`;
                            } else if (plays.length > 0) {
                                possiblePlaysString += `\nNOTE: Since there are fewer than 5 plays, these are your ONLY valid options. You must choose one of them.`;
                            }
                        }
                    }
                    
                    if (autoPass) {
                        const playRes = await playCards(playerId, config.ROOM_ID, []);
                        if (playRes.success) {
                            console.log('✅ Auto-pass executed successfully.');
                            lastError = null;
                        } else {
                            console.error(`❌ Auto-pass rejected: ${playRes.error}`);
                            lastError = playRes.error;
                        }
                    } else {
                        const decision = await decideMove(client, sessionId, state, hand, lastError, possiblePlaysString);
                        console.log(`💡 Agent Reasoning: ${decision.reasoning}`);
                        console.log(`🃏 Action: Playing indices [${decision.cardIndices.join(', ')}]`);

                        if (logFile) {
                            const playedCards = decision.cardIndices.map(idx => hand[idx]).filter(Boolean);
                            fs.appendFileSync(logFile, JSON.stringify({
                                timestamp: new Date().toISOString(),
                                roundId: state.roundId,
                                sequenceNumber: state.sequenceNumber,
                                state: state.state,
                                hand: hand,
                                decision: decision,
                                playedCards: playedCards,
                                lastError: lastError
                            }) + '\n');
                        }

                        const playRes = await playCards(playerId, config.ROOM_ID, decision.cardIndices);
                        if (playRes.success) {
                            console.log('✅ Move executed successfully.');
                            lastError = null;
                        } else {
                            console.error(`❌ Move rejected: ${playRes.error}`);
                            lastError = playRes.error;
                        }
                    }


                } else if (turnPlayerId !== playerId) {
                    lastError = null; // Clear error if it's someone else's turn
                }
            }

            await new Promise(resolve => setTimeout(resolve, config.POLL_INTERVAL));
        }

    } catch (error) {
        console.error('💥 Fatal Error:', error.message);
        process.exit(1);
    }
}

main();
