const {compileTest} = require("./test.cjs");


console.log("Starting TypeScript in-memory compilation benchmark with Jest source...");
const startTime = performance.now();

compileTest();

const endTime = performance.now();
const duration = (endTime - startTime) / 1000;


console.log(`TypeScript compilation finished.`);
console.log(`Compilation took ${duration.toFixed(2)} seconds.`);