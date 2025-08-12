// node standalone version of the benchmark for local testing.

const { renderTest } = require("./src/react-render-test.cjs");

console.log("Starting TypeScript in-memory compilation benchmark...");
const startTime = performance.now();

renderTest();

const endTime = performance.now();
const duration = (endTime - startTime) / 1000;

console.log(`TypeScript compilation finished.`);
console.log(`Compilation took ${duration.toFixed(2)} seconds.`);
