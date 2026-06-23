const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'pokemon-berries');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

// Shuffle
for (let i = files.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [files[i], files[j]] = [files[j], files[i]];
}

const common = files.slice(0, 40);
const rare = files.slice(40, 65);
const mythical = files.slice(65, 75);

function randomRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const berries = [];

common.forEach(file => {
  berries.push({
    id: file.replace('.png', ''),
    file,
    name: file.replace('.png', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    rarity: 'Common',
    cost: randomRange(10, 40),
    hungerRestored: randomRange(15, 25)
  });
});

rare.forEach(file => {
  berries.push({
    id: file.replace('.png', ''),
    file,
    name: file.replace('.png', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    rarity: 'Rare',
    cost: randomRange(50, 120),
    hungerRestored: randomRange(40, 60)
  });
});

mythical.forEach(file => {
  berries.push({
    id: file.replace('.png', ''),
    file,
    name: file.replace('.png', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    rarity: 'Mythical',
    cost: randomRange(150, 300),
    hungerRestored: 100
  });
});

berries.sort((a, b) => {
  const rarities = { 'Common': 1, 'Rare': 2, 'Mythical': 3 };
  if (rarities[a.rarity] !== rarities[b.rarity]) return rarities[a.rarity] - rarities[b.rarity];
  return a.cost - b.cost;
});

const fileContent = `const pokemonBerries = ${JSON.stringify(berries, null, 2)};`;

fs.writeFileSync(path.join(__dirname, 'berries.js'), fileContent);
console.log('berries.js created successfully with', berries.length, 'berries.');
