const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const glob = require("glob");

class Importer {
  constructor() {
    this.repoUrl = "https://github.com/jestjs/jest.git";
    this.baseDir = path.resolve(__dirname);
    this.repoDir = path.resolve(__dirname, "../jest.git");
    this.outputDir = path.resolve(__dirname, "../src/gen");
    this.fileContents = {};
  }

  cloneRepo() {
    if (!fs.existsSync(this.repoDir)) {
      console.log(`Cloning src data repository to ${this.repoDir}`);
      execSync(`git clone ${this.repoUrl} ${this.repoDir}`);
    } else {
      console.log("Jest repository already exists. Skipping clone.");
    }
  }

  readPackageFiles() {
    console.log("Reading files from packages into memory...");
    const patterns = ["packages/**/*.ts", "packages/**/*.d.ts", "packages/*.d.ts"];
    patterns.forEach(pattern => {
      const files = glob.sync(pattern, { cwd: this.repoDir, nodir: true });
      files.forEach(file => {
        const filePath = path.join(this.repoDir, file);
        const relativePath = path.relative(this.repoDir, filePath);
        this.fileContents[relativePath] = fs.readFileSync(filePath, "utf8");
        console.log(file);
      });
    });
  }

  addExtraFilesFromDirs() {
    const extraDirs = [
      { dir: '../node_modules/@types/' },
      { dir: '../node_modules/typescript/lib/' },
      { dir: "../node_modules/jest-worker/build/" },
      { dir: "../node_modules/@jridgewell/trace-mapping/types/" },
      { dir: "../node_modules/minimatch/dist/esm/" },
      { dir: "../node_modules/glob/dist/esm/" },
      { dir: "../../node_modules/tempy/node_modules/type-fest/source/" }
    ];

    extraDirs.forEach(({ dir, nameOnly = false }) => {
      const absoluteSourceDir = path.resolve(__dirname, dir);
      let allFiles = glob.sync('**/*.d.ts', { cwd: absoluteSourceDir, nodir: true });
      allFiles = allFiles.concat(glob.sync('**/*.d.mts', { cwd: absoluteSourceDir, nodir: true }));

      allFiles.forEach(file => {
        const filePath = path.join(absoluteSourceDir, file);
        let relativePath = path.join(dir, path.relative(absoluteSourceDir, filePath));
        if (nameOnly) {
          relativePath = path.basename(relativePath);
        }
        this.fileContents[relativePath] = fs.readFileSync(filePath, 'utf8');
      });
    });
  }

  addSpecificFiles() {
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
      const filePath = path.join(this.baseDir, file);
      if (fs.existsSync(filePath)) {
        this.fileContents[file] = fs.readFileSync(filePath, "utf8");
      } else {
        console.warn(`File not found, skipping: ${filePath}`);
      }
    });
  }

  writeFilesData() {
    const filesDataPath = path.join(this.outputDir, "src_files_data.cjs");
    fs.writeFileSync(
      filesDataPath,
      "module.exports = " + JSON.stringify(this.fileContents, null, 2) + ";"
    );
    console.log(`Created ${filesDataPath}`);
  }

  writeTsConfig() {
    console.log("Extracting tsconfig.json...");
    const tsconfigInputPath = path.join(this.repoDir, "tsconfig.json");
    const tsconfigContent = fs.readFileSync(tsconfigInputPath, "utf8");
    const tsconfig = JSON.parse(tsconfigContent.replace(/(?:^|\s)\/\/.*$|\/\*[\s\S]*?\*\//gm, ""));

    const tsconfigOutputPath = path.join(this.outputDir, "src_tsconfig.cjs");
    fs.writeFileSync(
      tsconfigOutputPath,
      "module.exports = " + JSON.stringify(tsconfig, null, 2) + ";"
    );
    console.log(`Created ${tsconfigOutputPath}`);
  }

  run() {
    this.cloneRepo();
    this.readPackageFiles();
    this.addExtraFilesFromDirs();
    this.addSpecificFiles();
    this.writeFilesData();
    this.writeTsConfig();
    console.log("Build process complete.");
  }
}

const importer = new Importer();
importer.run();
