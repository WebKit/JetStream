import { runTest } from "./src/test.mjs";

const then = performance.now();
runTest();
const duration = performance.now() - then;

console.log(`Duration : ${duration.toFixed(2)}ms`);