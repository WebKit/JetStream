const { performance } = require('perf_hooks');
const fs = require('fs');
const d3 = require('d3');

async function main() {
    const { runTest } = await import('./src/test.mjs');

    const usData = JSON.parse(fs.readFileSync('./src/data/counties-albers-10m.json', 'utf-8'));
    const airportsData = fs.readFileSync('./src/data/airports.csv', 'utf-8');
    const airports = d3.csvParse(airportsData, d3.autoType);

    const startTime = performance.now();

    const svg = await runTest(airports, usData);

    const endTime = performance.now();

    // console.log(svg); // The SVG output
    console.log(`Execution time: ${endTime - startTime} ms`);
}

main();