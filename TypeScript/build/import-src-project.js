const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const glob = require("glob");

const repoUrl = "https://github.com/jestjs/jest.git";
const baseDir = path.resolve(__dirname);
const repoDir = path.resolve(__dirname, "../jest.git");
const outputDir = path.resolve(__dirname, "../src");

// 1. Clone the repository
if (!fs.existsSync(repoDir)) {
  console.log(`Cloning src data repository to ${repoDir}`);
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

function addExtraFiles(relativeSourceDir) {
  const absoluteSourceDir = path.resolve(__dirname, relativeSourceDir);
  let allFiles = glob.sync('**/*.d.ts', { cwd: absoluteSourceDir, nodir: true });
  allFiles = allFiles.concat(glob.sync('**/*.d.mts', { cwd: absoluteSourceDir, nodir: true }));

  allFiles.forEach(file => {
    const filePath = path.join(absoluteSourceDir, file);
    const relativePath = path.join(relativeSourceDir, path.relative(absoluteSourceDir, filePath));
    fileContents[relativePath] = fs.readFileSync(filePath, 'utf8');
  });
};

addExtraFiles('../node_modules/@types/');
addExtraFiles('../node_modules/typescript/lib/');
addExtraFiles("../node_modules/jest-worker/build/");
addExtraFiles("../node_modules/@jridgewell/trace-mapping/types/");
addExtraFiles("../node_modules/minimatch/dist/esm/");
addExtraFiles("../node_modules/glob/dist/esm/");
addExtraFiles("../../node_modules/tempy/node_modules/type-fest/source/");
// addExtraFiles("");

// Add other extra files as needed
const extraFiles = [
  "../../node_modules/@babel/types/lib/index.d.ts",
  "../../node_modules/callsites/index.d.ts",
  "../../node_modules/camelcase/index.d.ts",
  "../../node_modules/chalk/types/index.d.ts",
  "../../node_modules/execa/index.d.ts",
  "../../node_modules/fast-json-stable-stringify/index.d.ts",
  "../../node_modules/get-stream/index.d.ts",
  "../../node_modules/strip-json-comments/index.d.ts",
  "../../node_modules/tempy/index.d.ts",
  "../../node_modules/tempy/node_modules/type-fest/index.d.ts",
  "../node_modules/@jridgewell/trace-mapping/types/trace-mapping.d.mts",
  "../node_modules/@types/eslint/index.d.ts",
  "../node_modules/ansi-regex/index.d.ts",
  "../node_modules/ansi-styles/index.d.ts",
  "../node_modules/glob/dist/esm/index.d.ts",
  "../node_modules/jest-worker/build/index.d.ts",
  "../node_modules/lru-cache/dist/esm/index.d.ts",
  "../node_modules/minipass/dist/esm/index.d.ts",
  "../node_modules/p-limit/index.d.ts",
  "../node_modules/path-scurry/dist/esm/index.d.ts",
  "../node_modules/typescript/lib/lib.dom.d.ts",
];

extraFiles.forEach(file => {
  const filePath = path.join(baseDir, file);
  console.assert(fs.existsSync(filePath)); 
  fileContents[file] = fs.readFileSync(filePath, "utf8");
});



// 3. Create the jest_src.cjs module
fs.writeFileSync(
  path.join(outputDir, "jest_src_data.cjs"),
  "module.exports = " + JSON.stringify(fileContents, null, 2) + ";"
);
console.log("Created src/jest_src_data.cjs");

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