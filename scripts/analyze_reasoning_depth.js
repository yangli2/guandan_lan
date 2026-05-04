const fs = require('fs');
const path = require('path');
const splitDir = path.join(__dirname, '..', 'logs', 'split');
const files = fs.readdirSync(splitDir).filter(f => f.endsWith('.json'));

console.log('=== DEEP REASONING WEAKNESS ANALYSIS ===\n');

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(path.join(splitDir, file), 'utf-8'));
  if (data.length < 20) continue;
  const gameId = file.replace('.json', '');

  // 1. Track how many times each bot uses a bomb and correlate with win/loss
  const bombsByBot = {};
  const totalPlaysByBot = {};
  
  for (const e of data) {
    if (e.source === 'SERVER' && e.event === 'bot_play') {
      totalPlaysByBot[e.playerId] = (totalPlaysByBot[e.playerId] || 0) + 1;
      if (e.type === 'PLAY' && (e.cardIndices || []).length >= 4) {
        bombsByBot[e.playerId] = (bombsByBot[e.playerId] || 0) + 1;
      }
    }
  }

  // 2. Find cases where bot COULD have played a bigger combo but chose singles
  // Specifically: bot has lead, has pairs/triples, but leads with single
  let inefficientLeads = 0;
  
  for (let i = 0; i < data.length; i++) {
    const e = data[i];
    if (e.source && e.source.startsWith('AGENT-') && e.decision && e.hand) {
      const indices = e.decision.cardIndices || [];
      const hand = e.hand;
      const reasoning = e.decision.reasoning || '';
      
      // Count hand patterns
      const rankCounts = {};
      for (const card of hand) {
        const r = card.rank || 'JOKER';
        rankCounts[r] = (rankCounts[r] || 0) + 1;
      }
      
      // Check for "dump strategy" failures
      // Bot leads single when it has a triple, when opponent has MORE cards
      if (indices.length === 1 && hand.length >= 8) {
        const hasTriple = Object.values(rankCounts).some(c => c >= 3);
        const hasTwoOrMorePairs = Object.values(rankCounts).filter(c => c >= 2).length >= 2;
        const hasLead = reasoning.toLowerCase().includes('have the lead') || 
                       reasoning.toLowerCase().includes('hold the lead') ||
                       reasoning.toLowerCase().includes('free lead');
        
        if (hasLead && hasTriple) {
          console.log(`  [SINGLE-OVER-TRIPLE] ${e.source} (${gameId.substr(-8)}) seq ${e.sequenceNumber}:`);
          console.log(`    Hand (${hand.length}): ${hand.map(c => `${c.rank}${c.suit||''}`).join(', ')}`);
          console.log(`    Played single instead of triple. Reasoning: ${reasoning.substring(0, 200)}`);
          console.log();
          inefficientLeads++;
        }
      }
      
      // 3. Check for "clearing junk one at a time" syndrome
      // Bot with lead plays single, then gets lead again and plays another single
      // This is the scatter problem
      
      // 4. Check if bot uses bomb to take lead then plays... a single
      if (indices.length >= 4) {
        // This is a bomb play, look at next play by same bot
        for (let j = i + 1; j < Math.min(data.length, i + 20); j++) {
          if (data[j].source === e.source && data[j].decision) {
            const nextIndices = data[j].decision.cardIndices || [];
            const nextHand = data[j].hand || [];
            if (nextIndices.length === 1 && nextHand.length >= 6) {
              console.log(`  [BOMB-THEN-SINGLE] ${e.source} (${gameId.substr(-8)}) seq ${e.sequenceNumber} -> ${data[j].sequenceNumber}:`);
              console.log(`    Bombed to take lead, then played single with ${nextHand.length} cards remaining`);
              console.log(`    Next hand: ${nextHand.map(c => `${c.rank}${c.suit||''}`).join(', ')}`);
              console.log(`    Reasoning: ${(data[j].decision.reasoning || '').substring(0, 200)}`);
              console.log();
            }
            break;
          }
        }
      }
      
      // 5. Count how many consecutive single-card plays when bot has lead
      // This is the key "scattered hand" syndrome
    }
  }

  // 6. Track hand-size reduction efficiency (cards cleared per turn with lead)
  console.log(`\n  --- GAME ${gameId.substr(-8)} BOMB ECONOMY ---`);
  for (const [pid, count] of Object.entries(bombsByBot)) {
    const total = totalPlaysByBot[pid] || 1;
    console.log(`    ${pid}: ${count} bombs in ${total} plays (${(count/total*100).toFixed(0)}%)`);
  }

  // 7. Look for "mutual destruction" - both teams escalate bombs until everyone has weak hands
  const firstEvent = data.find(e => e.source === 'SERVER' && e.hands);
  const lastServerEvent = [...data].reverse().find(e => e.source === 'SERVER' && e.hands);
  if (firstEvent && lastServerEvent) {
    console.log(`\n  --- HAND SIZE PROGRESSION ---`);
    for (const pid of Object.keys(firstEvent.hands)) {
      const startCards = firstEvent.hands[pid].length;
      const endCards = lastServerEvent.hands[pid]?.length || 0;
      const cleared = startCards - endCards;
      const totalPlays = totalPlaysByBot[pid] || 1;
      const cardsPerPlay = (cleared / totalPlays).toFixed(1);
      console.log(`    ${pid}: ${startCards} -> ${endCards} cards (${cleared} cleared in ${totalPlays} plays, ${cardsPerPlay} cards/play)`);
    }
  }
}
