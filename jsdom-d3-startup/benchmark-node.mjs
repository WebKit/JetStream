import { performance } from 'perf_hooks';
import fs from 'fs';
import * as d3 from 'd3';
import { runTest } from './src/test.mjs';

async function main() {
    const usData = JSON.parse(fs.readFileSync('./data/counties-albers-10m.json', 'utf-8'));
    const airportsData = fs.readFileSync('./data/airports.csv', 'utf-8');

    const startTime = performance.now();

    const svg = await runTest(airportsData, usData);

    const endTime = performance.now();

    // console.log(svg); // The SVG output
    console.log(`Execution time: ${endTime - startTime} ms`);
}

main();
