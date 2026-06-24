const fs = require('fs');

const data = fs.readFileSync('berries.js', 'utf8');
// remove "const pokemonBerries = " and ";"
const jsonStr = data.replace('const pokemonBerries = ', '').replace(/;$/, '').trim();
let berries = JSON.parse(jsonStr);

function processRarity(rarity, minH, maxH) {
    let group = berries.filter(b => b.rarity === rarity);
    
    // Sort group by cost
    group.sort((a, b) => a.cost - b.cost);
    
    // Generate random hunger values
    let hungers = [];
    for (let i = 0; i < group.length; i++) {
        let h = Math.floor(Math.random() * (maxH - minH + 1)) + minH;
        hungers.push(h);
    }
    
    // Sort hungers
    hungers.sort((a, b) => a - b);
    
    // Assign
    for (let i = 0; i < group.length; i++) {
        group[i].hungerRestored = hungers[i];
    }
}

processRarity("Common", 20, 35);
processRarity("Rare", 40, 60);
processRarity("Mythical", 65, 100);

const outData = 'const pokemonBerries = ' + JSON.stringify(berries, null, 4) + ';\n';
fs.writeFileSync('berries.js', outData, 'utf8');
console.log('Berries updated!');
