import { compileTest } from "./test.mjs";
import tsConfig from "./gen/immer-tiny/tsconfig.json" with { type: "json" };
import srcFileData from "./gen/immer-tiny/files.json" with { type: "json" };

console.log("Starting TypeScript in-memory compilation benchmark...");
const startTime = performance.now();

compileTest(tsConfig, srcFileData);

const endTime = performance.now();
const duration = (endTime - startTime) / 1000;

console.log(`TypeScript compilation finished.`);
console.log(`Compilation took ${duration.toFixed(2)} seconds.`);
