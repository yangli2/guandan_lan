import { createOpencodeClient } from '@opencode-ai/sdk';
import { Agent, setGlobalDispatcher } from 'undici';
import fs from 'fs';
import path from 'path';
import { joinGame, getGameState, playCards } from './tools.js';
import config from './config.js';

// Increase the global fetch timeout to 100 minutes (6,000,000 ms)
// This prevents the UND_ERR_HEADERS_TIMEOUT error during deep reasoning
setGlobalDispatcher(new Agent({
    headersTimeout: 6000000,
    bodyTimeout: 6000000,
    keepAliveTimeout: 6000000
}));

export async function initAgent() {
    const client = createOpencodeClient({
        baseUrl: 'http://localhost:4096', // Default opencode server port
    });

    const skillPath = path.join(process.cwd(), 'skills/guandan.js');
    const guandanSkill = fs.readFileSync(skillPath, 'utf8');

    return { client, guandanSkill };
}

export async function decideMove(client, sessionId, gameState, hand, lastError = null, possiblePlaysString = '') {
    console.log(`🤔 Agent is deciding move for session ${sessionId}...`);

    const reasoningDirectives = {
        BASIC: "Provide a quick, intuitive move based on the first valid option.",
        ADVANCED: "Analyze the hand, current level, and partner's state. Evaluate 2-3 possible moves and choose the most strategic one.",
        DEEP: "Conduct a comprehensive simulation. Analyze every possible combination in hand, predict potential opponent responses, evaluate the risk of 'returning-head', and optimize for the team's long-term victory. Think step-by-step and justify the final decision with a detailed logic chain."
    };

    const level = config.REASONING_LEVEL || 'DEEP';
    const directive = reasoningDirectives[level] || reasoningDirectives.DEEP;

    const me = gameState.players[gameState.turn];
    const partner = gameState.players.find(p => p.team === me?.team && p.id !== me?.id);
    const identityPrompt = me ? `You are ${me.name} (Team ${me.team}). Your partner is ${partner ? partner.name : 'Unknown'}.` : '';

    const errorPrompt = lastError 
        ? `\n🚨 CRITICAL ERROR: Your PREVIOUS attempt to play was REJECTED by the game engine with this error message:\n"${lastError}"\nYou MUST figure out why your move was invalid, fix your mistake, and choose a DIFFERENT valid move. Do NOT repeat the same mistake!\n` 
        : '';

    const prompt = `
            REASONING LEVEL: ${level}
            DIRECTIVE: ${directive}

            ${identityPrompt}
            ${errorPrompt}
            ${possiblePlaysString}

            Current Game Level: ${gameState.currentLevel}
            Team Levels: Team 0: ${gameState.teamLevels?.[0] || 'N/A'}, Team 1: ${gameState.teamLevels?.[1] || 'N/A'}
            
            Current Game State:
        ${JSON.stringify(gameState, null, 2)}

        Your Hand:
        ${JSON.stringify(hand, null, 2)}

        ${gameState.state === 'RETURN_TRIBUTE'
            ? "ATTENTION: You are in the RETURN_TRIBUTE phase. You MUST select EXACTLY ONE card (index) from your hand to return to the loser. It should usually be a low value card."
            : "Based on the Guandan rules, the current level, and your strategy, what is your next move?\n        If you want to play cards, provide the indices of the cards in your hand.\n        If you want to pass, provide an empty array."}

        You have access to terminal tools and a python interpreter. Perform actions as you see fit to calculate probabilities or simulate scenarios.
        
        CRITICAL: Once you have decided on your move, you MUST output it in the following XML format:
        <move>
        {
          "cardIndices": [indices],
          "reasoning": "your detailed reasoning"
        }
        </move>
    `;

    try {
        const result = await client.session.prompt({
            path: { id: sessionId },
            body: {
                parts: [{ type: 'text', text: prompt }]
            },
        });
        console.log('✅ Agentic loop finished.');

        // Fetch all messages to find the final move
        const messagesRes = await client.session.messages({ path: { id: sessionId } });
        const messages = messagesRes.data || [];
        
        // Find the last assistant message that contains a <move> tag
        let finalMove = null;
        for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.info.role === 'assistant') {
                const text = msg.parts.find(p => p.type === 'text')?.text || '';
                const match = text.match(/<move>([\s\S]*?)<\/move>/);
                if (match) {
                    try {
                        finalMove = JSON.parse(match[1].trim());
                        break;
                    } catch (e) {
                        console.warn('⚠️ Failed to parse move JSON from tag:', e);
                    }
                }
            }
        }

        if (!finalMove) {
            console.warn('⚠️ No <move> tag found in agent output. Invoking critique agent...');

            const lastText = messages.length > 0 ? (messages[messages.length-1].parts.find(p => p.type === 'text')?.text || '') : '';

            const critiquePrompt = `
You are a critique agent. The previous agent failed to produce a valid <move> tag with JSON content.
Here is its final response:
---
${lastText}
---

Your task is to extract the intended move and format it perfectly as JSON inside a <move> tag.
Example:
<move>
{
  "cardIndices": [0, 1, 2],
  "reasoning": "..."
}
</move>
`;

            const fixResult = await client.session.prompt({
                path: { id: sessionId },
                body: {
                    parts: [{ type: 'text', text: critiquePrompt }]
                }
            });

            // Re-fetch messages to get the fix
            const fixMessagesRes = await client.session.messages({ path: { id: sessionId } });
            const fixMessages = fixMessagesRes.data || [];
            
            for (let i = fixMessages.length - 1; i >= 0; i--) {
                const msg = fixMessages[i];
                if (msg.info.role === 'assistant') {
                    const text = msg.parts.find(p => p.type === 'text')?.text || '';
                    const match = text.match(/<move>([\s\S]*?)<\/move>/);
                    if (match) {
                        try {
                            finalMove = JSON.parse(match[1].trim());
                            break;
                        } catch (e) {
                            console.error('❌ Failed to parse fixed move JSON:', e);
                        }
                    }
                }
            }
        }

        if (!finalMove) {
            console.error('❌ Agent failed to provide a move. Defaulting to pass.');
            return { cardIndices: [], reasoning: 'Agent failed to provide a move' };
        }

        return finalMove;
    } catch (e) {
        console.error('❌ Error during decideMove:', e);
        throw e;
    }
}

