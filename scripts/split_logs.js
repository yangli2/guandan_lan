
const fs = require('fs');
const path = require('path');

const inputFile = 'combined_game_log.json';
const outputDir = path.join('logs', 'split');

if (!fs.existsSync(inputFile)) {
    console.error(`Error: ${inputFile} not found.`);
    process.exit(1);
}

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

console.log(`Reading ${inputFile}...`);
const logs = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

const rounds = {};
logs.forEach(log => {
    const rid = log.roundId || 'unknown';
    if (!rounds[rid]) rounds[rid] = [];
    rounds[rid].push(log);
});

const roundIds = Object.keys(rounds);
console.log(`Found ${roundIds.length} unique rounds.`);

roundIds.forEach(rid => {
    const fileName = rid === 'unknown' ? 'unknown_round.json' : `${rid}.json`;
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(rounds[rid], null, 2));
    console.log(`  - Saved ${rounds[rid].length} entries to ${fileName}`);
});

console.log(`\n✅ Split completed. Files are in ${outputDir}`);
