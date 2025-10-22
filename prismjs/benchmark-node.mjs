import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runTest } from "./src/test.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const samples = [
  { file: "data/sample.html", lang: "markup" },
  { file: "data/sample.js", lang: "javascript" },
  { file: "data/sample.css", lang: "css" },
  { file: "data/sample.cpp", lang: "cpp" },
  { file: "data/sample.md", lang: "markdown" },
  { file: "data/sample.json", lang: "json" },
  { file: "data/sample.sql", lang: "sql" },
  { file: "data/sample.py", lang: "python" },
  { file: "data/sample.ts", lang: "typescript" },
];

const samplesWithContent = samples.map((sample) => {
  const content = fs.readFileSync(path.join(__dirname, sample.file), "utf8");
  return { ...sample, content };
});

const startTime = process.hrtime.bigint();
const results = runTest(samplesWithContent);
const endTime = process.hrtime.bigint();

const duration = Number(endTime - startTime) / 1e6; // milliseconds

for (const result of results) {
  console.log(`Output size: ${result.html.length} characters`);
}

console.log(
  `\nTotal highlighting time for all files: ${duration.toFixed(2)}ms`
);
