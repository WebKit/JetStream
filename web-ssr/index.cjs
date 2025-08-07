const { runBenchmark } = require('./src/benchmark.cjs');

console.log('Starting React renderToString benchmark...');

const start = process.hrtime();
const results = runBenchmark();
const end = process.hrtime(start);

const duration = (end[0] * 1e9 + end[1]) / 1e6; // convert to milliseconds
console.log(`runBenchmark function took ${duration.toFixed(2)}ms`);

console.log(`Rendered HTML length: ${results.htmlLength} characters`);
console.log('Benchmark finished.');
