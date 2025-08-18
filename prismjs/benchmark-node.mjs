import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runTest } from "./src/test.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samples = [
  { data: "data/sample.html", lang: "markup" },
  { data: "data/sample.js", lang: "javascript" },
  { data: "data/sample.css", lang: "css" },
  { data: "data/sample.cpp", lang: "cpp" },
];

const samplesWithContent = samples.map(sample => {
    const content = fs.readFileSync(path.join(__dirname, sample.file), "utf8");
    return { ...sample, content };
});

const startTime = process.hrtime.bigint();
const results = runTest(samplesWithContent);
const endTime = process.hrtime.bigint();

const duration = Number(endTime - startTime) / 1e6; // milliseconds

for (const result of results) {
    console.log(`\n--- Test Result: (${result.file}) ---`);
    console.log(`File size: ${result.originalSize} characters`);
    console.log(`Output size: ${result.highlightedSize} characters`);
}

console.log(`\nTotal highlighting time for all files: ${duration.toFixed(2)}ms`);