const fs = require('fs');
const path = require('path');

const splitDir = path.join(__dirname, '..', 'logs', 'split');
const files = fs.readdirSync(splitDir).filter(f => f.endsWith('.json'));

// Deep analysis of specific weakness patterns
console.log('=== DEEP ENDGAME & STRATEGY WEAKNESS ANALYSIS ===\n');

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(splitDir, file), 'utf-8'));
  if (data.length < 20) continue;
  
  const gameId = file.replace('.json', '');
  console.log(`\n${'='.repeat(70)}`);
  console.log(`GAME: ${gameId} (${data.length} events)`);
  
  // 1. BOMB ESCALATION WARS - find sequences where bombs cascade
  let bombChain = [];
  for (let i = 0; i < data.length; i++) {
    const e = data[i];
    if (e.source === 'SERVER' && e.event === 'bot_play' && e.type === 'PLAY') {
      const indices = e.cardIndices || [];
      if (indices.length >= 4) {
        // Check the hand to see if all same rank
        const hand = e.hands && e.hands[e.playerId];
        bombChain.push({ seq: e.sequenceNumber, player: e.playerId, size: indices.length, idx: i });
      } else {
        if (bombChain.length >= 2) {
          console.log(`\n  ** BOMB ESCALATION WAR (${bombChain.length} bombs in sequence): **`);
          for (const b of bombChain) {
            // Find the agent reasoning
            const agentEntry = data.slice(Math.max(0, b.idx - 3), b.idx).find(d => d.source && d.source.startsWith('AGENT-') && d.sequenceNumber === b.seq - 1);
            const reasoning = agentEntry ? (agentEntry.decision?.reasoning || '').substring(0, 200) : 'N/A';
            console.log(`    seq ${b.seq}: ${b.player} played ${b.size}-card bomb`);
            console.log(`      Reasoning: ${reasoning.substring(0, 150)}`);
          }
        }
        bombChain = [];
      }
    }
  }
  
  // 2. END-GAME SCATTERED HANDS - Look at hands when <=10 cards remaining
  console.log('\n  --- END-GAME HAND SHAPES ---');
  const seenBots = new Set();
  for (let i = data.length - 1; i >= 0; i--) {
    const e = data[i];
    if (e.source && e.source.startsWith('AGENT-') && e.hand && e.hand.length > 0 && e.hand.length <= 10) {
      if (seenBots.has(e.source)) continue;
      seenBots.add(e.source);
      
      const hand = e.hand;
      const rankCounts = {};
      for (const card of hand) {
        const r = card.rank || 'JOKER';
        rankCounts[r] = (rankCounts[r] || 0) + 1;
      }
      const singles = Object.values(rankCounts).filter(c => c === 1).length;
      const pairs = Object.values(rankCounts).filter(c => c === 2).length;
      const triples = Object.values(rankCounts).filter(c => c === 3).length;
      const quads = Object.values(rankCounts).filter(c => c >= 4).length;
      const minTricks = singles + pairs + triples + quads;
      
      const handStr = hand.map(c => `${c.rank}${c.suit || ''}`).join(', ');
      console.log(`    ${e.source} (seq ${e.sequenceNumber}): ${hand.length} cards -> ${singles}S/${pairs}P/${triples}T/${quads}Q = ~${minTricks} tricks needed`);
      console.log(`      Hand: ${handStr}`);
      
      // Flag if very scattered
      if (singles >= hand.length * 0.7 && hand.length >= 4) {
        console.log(`      *** CRITICAL: ${Math.round(singles/hand.length*100)}% singles - extremely scattered! ***`);
      }
    }
  }
  
  // 3. PARTNER INTERFERENCE - Cases where a bot beats their own partner
  console.log('\n  --- PARTNER INTERFERENCE ANALYSIS ---');
  // Try to infer teams from the first game_started event
  const startEvent = data.find(e => e.source === 'SERVER' && e.event && e.event.startsWith('game_started'));
  if (startEvent && startEvent.hands) {
    const players = Object.keys(startEvent.hands);
    // In Guandan, players 0&2 are Team 0, players 1&3 are Team 1
    const team0 = [players[0], players[2]];
    const team1 = [players[1], players[3]];
    
    // Map AGENT names to player IDs
    const agentToPlayer = {};
    for (const e of data) {
      if (e.source && e.source.startsWith('AGENT-') && e.hand) {
        // Match by hand comparison to find which agent maps to which player
        const agentHand = JSON.stringify(e.hand.map(c => c.rank + (c.suit || '')).sort());
        if (!agentToPlayer[e.source]) {
          for (const [pid, hand] of Object.entries(startEvent.hands)) {
            const serverHand = JSON.stringify(hand.map(c => c.rank + (c.suit || '')).sort());
            if (agentHand === serverHand) {
              agentToPlayer[e.source] = pid;
              break;
            }
          }
        }
      }
    }
    
    // Now check for cases where bot plays over partner
    let lastPlay = null;
    for (const e of data) {
      if (e.source === 'SERVER' && e.event === 'bot_play' && e.type === 'PLAY') {
        if (lastPlay) {
          const lastTeam = team0.includes(lastPlay.playerId) ? 0 : 1;
          const currTeam = team0.includes(e.playerId) ? 0 : 1;
          if (lastTeam === currTeam && e.playerId !== lastPlay.playerId) {
            // Same team played over each other
            console.log(`    seq ${e.sequenceNumber}: ${e.playerId} beat partner ${lastPlay.playerId} (Team ${currTeam})`);
          }
        }
        lastPlay = e;
      } else if (e.source === 'SERVER' && e.event === 'bot_play' && e.type === 'PASS') {
        // don't update lastPlay
      }
    }
  }
  
  // 4. WASTED BOSS CARDS - Playing Jokers/Level cards when not needed
  console.log('\n  --- BOSS CARD USAGE AUDIT ---');
  for (const e of data) {
    if (e.source && e.source.startsWith('AGENT-') && e.decision && e.hand) {
      const indices = e.decision.cardIndices || [];
      if (indices.length === 0) continue;
      
      const playedCards = indices.map(idx => e.hand[idx]).filter(Boolean);
      const hasBossCard = playedCards.some(c => c.rank === 'BJ' || c.rank === 'SJ');
      
      if (hasBossCard && indices.length <= 2 && e.hand.length > 15) {
        console.log(`    ${e.source} @ seq ${e.sequenceNumber}: Used ${playedCards.map(c => c.rank).join(',')} with ${e.hand.length} cards remaining`);
        console.log(`      Reasoning: ${(e.decision.reasoning || '').substring(0, 200)}`);
      }
    }
  }
  
  // 5. LEADING SINGLES WHEN OPPONENT IS LOW - dangerous single leads when opponent has few cards
  console.log('\n  --- DANGEROUS SINGLE LEADS (opponent low card count) ---');
  for (let i = 0; i < data.length; i++) {
    const e = data[i];
    if (e.source === 'SERVER' && e.event === 'bot_play' && e.type === 'PLAY') {
      const indices = e.cardIndices || [];
      if (indices.length === 1 && e.hands) {
        // Check if any opponent has <= 5 cards
        const players = Object.keys(e.hands);
        const playerIdx = players.indexOf(e.playerId);
        // Opponents are +1 and +3 positions
        const opp1 = players[(playerIdx + 1) % 4];
        const opp2 = players[(playerIdx + 3) % 4];
        const opp1Count = e.hands[opp1]?.length || 99;
        const opp2Count = e.hands[opp2]?.length || 99;
        const minOppCards = Math.min(opp1Count, opp2Count);
        
        if (minOppCards <= 4) {
          // Find agent reasoning
          const agentEntry = data.slice(Math.max(0, i - 3), i).find(d => d.source && d.source.startsWith('AGENT-'));
          const reasoning = agentEntry ? (agentEntry.decision?.reasoning || '').substring(0, 150) : '';
          console.log(`    seq ${e.sequenceNumber}: ${e.playerId} led SINGLE with opponent at ${minOppCards} cards`);
          console.log(`      Reasoning: ${reasoning}`);
        }
      }
    }
  }
}
