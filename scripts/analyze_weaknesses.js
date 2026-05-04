const fs = require('fs');
const path = require('path');

const splitDir = path.join(__dirname, '..', 'logs', 'split');
const files = fs.readdirSync(splitDir).filter(f => f.endsWith('.json'));

// We'll analyze each game for specific weakness patterns
const results = [];

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(splitDir, file), 'utf-8'));
  if (data.length < 10) continue; // skip tiny/incomplete games
  
  const gameId = file.replace('.json', '');
  const gameAnalysis = {
    gameId,
    totalEvents: data.length,
    agentDecisions: [],
    endGameHands: {},
    scatteredHandIssues: [],
    passStreaks: [],
    bombUsage: [],
    failedPlays: [],
    singleCardLeads: [],
    partnerInterference: [],
    wastefulPlays: [],
  };

  // Track consecutive passes per player
  const passStreaks = {};
  const playerTeams = {}; // Will try to infer from log data
  
  // Extract all agent decisions with context
  for (let i = 0; i < data.length; i++) {
    const entry = data[i];
    
    if (entry.source && entry.source.startsWith('AGENT-')) {
      const botName = entry.source;
      const hand = entry.hand || [];
      const decision = entry.decision || {};
      const indices = decision.cardIndices || [];
      const reasoning = decision.reasoning || '';
      const lastError = entry.lastError;
      const state = entry.state;
      const seq = entry.sequenceNumber;
      
      // Track failed plays
      if (lastError) {
        gameAnalysis.failedPlays.push({
          bot: botName,
          seq,
          error: lastError,
          handSize: hand.length,
          reasoning: reasoning.substring(0, 200),
        });
      }
      
      // Analyze hand "scatter" - count distinct ranks and how many tricks needed
      if (hand.length > 0 && hand.length <= 15 && indices.length > 0) {
        const rankCounts = {};
        for (const card of hand) {
          const r = card.rank || 'JOKER';
          rankCounts[r] = (rankCounts[r] || 0) + 1;
        }
        
        // Estimate minimum tricks to clear hand
        const counts = Object.values(rankCounts);
        let minTricks = 0;
        const singles = counts.filter(c => c === 1).length;
        const pairs = counts.filter(c => c === 2).length;
        const triples = counts.filter(c => c === 3).length;
        const quads = counts.filter(c => c >= 4).length;
        
        // Very rough: each single = 1 trick, each pair = 1 trick, each triple+kicker = 1 trick
        minTricks = singles + pairs + triples + quads;
        
        // If bot claims "winning role" but has high scatter
        const claimsWinning = reasoning.toLowerCase().includes('winning role') || 
                              reasoning.toLowerCase().includes('main attacker') ||
                              reasoning.toLowerCase().includes('winning position');
        
        if (claimsWinning && singles >= 3 && hand.length <= 12) {
          gameAnalysis.scatteredHandIssues.push({
            bot: botName,
            seq,
            handSize: hand.length,
            singles,
            pairs,
            triples,
            quads,
            minTricks,
            distinctRanks: Object.keys(rankCounts).length,
            hand: hand.map(c => `${c.rank}${c.suit || ''}`).join(', '),
            claimsWinning: true,
            reasoningSnippet: reasoning.substring(0, 300),
          });
        }
      }
      
      // Track pass streaks
      if (indices.length === 0 && state === 'PLAYING') {
        passStreaks[botName] = (passStreaks[botName] || 0) + 1;
      } else {
        if (passStreaks[botName] && passStreaks[botName] >= 3) {
          gameAnalysis.passStreaks.push({
            bot: botName,
            streak: passStreaks[botName],
            seq,
          });
        }
        passStreaks[botName] = 0;
      }
      
      // Track single-card leads when better options exist
      if (indices.length === 1 && hand.length > 5) {
        const rankCounts = {};
        for (const card of hand) {
          const r = card.rank || 'JOKER';
          rankCounts[r] = (rankCounts[r] || 0) + 1;
        }
        const hasPairs = Object.values(rankCounts).some(c => c >= 2);
        const hasTriples = Object.values(rankCounts).some(c => c >= 3);
        
        // Check if leading a single when they have pairs/triples to dump
        // (only when they HAVE the lead, i.e., reasoning suggests free lead)
        const hasLead = reasoning.toLowerCase().includes('i have the lead') ||
                       reasoning.toLowerCase().includes('i currently hold the lead') ||
                       reasoning.toLowerCase().includes('free lead') ||
                       reasoning.toLowerCase().includes('now have the lead');
        
        if (hasLead && (hasPairs || hasTriples) && hand.length > 8) {
          gameAnalysis.singleCardLeads.push({
            bot: botName,
            seq,
            handSize: hand.length,
            pairsAvailable: hasPairs,
            triplesAvailable: hasTriples,
            cardPlayed: hand[indices[0]] ? `${hand[indices[0]].rank}${hand[indices[0]].suit || ''}` : 'unknown',
            reasoningSnippet: reasoning.substring(0, 300),
          });
        }
      }

      // Track bomb usage
      if (indices.length >= 4) {
        const cards = indices.map(idx => hand[idx]).filter(Boolean);
        const ranks = cards.map(c => c.rank);
        const uniqueRanks = [...new Set(ranks)];
        if (uniqueRanks.length === 1 || (cards.length === 4 && uniqueRanks.length === 1)) {
          // This looks like a bomb
          // Find the next SERVER event to see what they were bombing over
          let bombedOver = null;
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            if (data[j].source === 'SERVER' && data[j].event === 'bot_play' && data[j].type === 'PLAY') {
              bombedOver = {
                playerId: data[j].playerId,
                cardCount: (data[j].cardIndices || []).length,
              };
              break;
            }
          }
          
          gameAnalysis.bombUsage.push({
            bot: botName,
            seq,
            bombSize: indices.length,
            bombRank: uniqueRanks[0],
            handSizeAfter: hand.length - indices.length,
            bombedOver,
            reasoningSnippet: reasoning.substring(0, 300),
          });
        }
      }
      
      gameAnalysis.agentDecisions.push({
        bot: botName,
        seq,
        handSize: hand.length,
        played: indices.length,
        state,
        error: lastError,
      });
    }
    
    // Track end-game hand sizes from SERVER events
    if (entry.source === 'SERVER' && entry.hands) {
      for (const [pid, hand] of Object.entries(entry.hands)) {
        gameAnalysis.endGameHands[pid] = hand.length;
      }
    }
  }
  
  // Only include games with meaningful data
  if (gameAnalysis.agentDecisions.length > 5) {
    results.push(gameAnalysis);
  }
}

// Print summary
console.log('=== GUANDAN BOT WEAKNESS ANALYSIS ===\n');

for (const game of results) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`GAME: ${game.gameId}`);
  console.log(`Total events: ${game.totalEvents}, Agent decisions: ${game.agentDecisions.length}`);
  console.log(`Final hand sizes: ${JSON.stringify(game.endGameHands)}`);
  
  if (game.scatteredHandIssues.length > 0) {
    console.log(`\n  ** SCATTERED HAND ISSUES (${game.scatteredHandIssues.length}): **`);
    for (const issue of game.scatteredHandIssues) {
      console.log(`    ${issue.bot} @ seq ${issue.seq}: ${issue.handSize} cards, ${issue.singles}S/${issue.pairs}P/${issue.triples}T/${issue.quads}Q, ~${issue.minTricks} min tricks`);
      console.log(`      Hand: ${issue.hand}`);
      console.log(`      Reasoning: ${issue.reasoningSnippet.substring(0, 150)}...`);
    }
  }
  
  if (game.failedPlays.length > 0) {
    console.log(`\n  ** FAILED PLAYS (${game.failedPlays.length}): **`);
    for (const fp of game.failedPlays) {
      console.log(`    ${fp.bot} @ seq ${fp.seq}: "${fp.error}" (${fp.handSize} cards)`);
    }
  }
  
  if (game.passStreaks.length > 0) {
    console.log(`\n  ** LONG PASS STREAKS (${game.passStreaks.length}): **`);
    for (const ps of game.passStreaks) {
      console.log(`    ${ps.bot}: ${ps.streak} consecutive passes ending at seq ${ps.seq}`);
    }
  }
  
  if (game.singleCardLeads.length > 0) {
    console.log(`\n  ** SINGLE LEADS WITH BETTER OPTIONS (${game.singleCardLeads.length}): **`);
    for (const scl of game.singleCardLeads) {
      console.log(`    ${scl.bot} @ seq ${scl.seq}: Led ${scl.cardPlayed} with ${scl.handSize} cards (pairs:${scl.pairsAvailable}, triples:${scl.triplesAvailable})`);
      console.log(`      Reasoning: ${scl.reasoningSnippet.substring(0, 150)}...`);
    }
  }
  
  if (game.bombUsage.length > 0) {
    console.log(`\n  ** BOMB USAGE (${game.bombUsage.length}): **`);
    for (const bu of game.bombUsage) {
      console.log(`    ${bu.bot} @ seq ${bu.seq}: ${bu.bombSize}-card bomb of ${bu.bombRank}, ${bu.handSizeAfter} cards remaining after`);
      if (bu.bombedOver) {
        console.log(`      Bombed over: ${bu.bombedOver.playerId} (${bu.bombedOver.cardCount} cards played)`);
      }
      console.log(`      Reasoning: ${bu.reasoningSnippet.substring(0, 150)}...`);
    }
  }
}
