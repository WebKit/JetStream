const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const glob = require("glob");

const repoUrl = "https://github.com/jestjs/jest.git";
const repoDir = path.resolve(__dirname, "../jest.git");
const outputDir = path.resolve(__dirname, "../src");

// 1. Clone the repository
if (!fs.existsSync(repoDir)) {
  console.log("Cloning Jest repository...");
  execSync("git clone " + repoUrl + " " + repoDir);
} else {
  console.log("Jest repository already exists. Skipping clone.");
}

// 2. Read all files from packages/* into memory
console.log("Reading files from packages into memory...");
const fileContents = {};
const files = glob.sync("packages/**/*.ts", { cwd: repoDir, nodir: true });

files.forEach(file => {
  const filePath = path.join(repoDir, file);
  // Use a relative path from the repo root as the key
  const relativePath = path.relative(repoDir, filePath);
  fileContents[relativePath] = fs.readFileSync(filePath, "utf8");
});

// 3. Create the jest_src.cjs module
fs.writeFileSync(
  path.join(outputDir, "jest_src_data.cjs"),
  "module.exports = " + JSON.stringify(fileContents, null, 2) + ";"
);
console.log("Created src/jest_src.cjs");

// 4. Extract and create the jest_tsconfig.cjs module
console.log("Extracting tsconfig.json...");
const tsconfigPath = path.join(repoDir, "tsconfig.json");
const tsconfigContent = fs.readFileSync(tsconfigPath, "utf8");
const tsconfig = JSON.parse(tsconfigContent.replace(/(?:^|\s)\/\/.*$|\/\*[\s\S]*?\*\//gm, ""));

fs.writeFileSync(
  path.join(outputDir, "jest_tsconfig.cjs"),
  "module.exports = " + JSON.stringify(tsconfig, null, 2) + ";"
);
console.log("Created src/jest_tsconfig.cjs");

console.log("Build process complete.");