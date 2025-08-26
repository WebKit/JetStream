import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { globSync } from "glob";
import assert from 'assert/strict';
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));


class Importer {
  constructor({ projectName, size, repoUrl, srcFolder, extraFiles, extraDirs }) {
    this.projectName = projectName;
    assert(projectName.endsWith(`-${size}`), "missing size annotation in projectName");
    this.repoUrl = repoUrl;
    this.baseDir = path.resolve(__dirname);
    let repoName = path.basename(this.repoUrl);
    if (!repoName.endsWith(".git")) {
      repoName = `${repoName}.git`;
    }
    this.repoDir = path.resolve(__dirname, repoName);
    this.srcFolder = srcFolder;
    this.outputDir = path.resolve(__dirname, `../src/gen/${this.projectName}`);
    fs.mkdirSync(this.outputDir, { recursive: true });
    this.srcFileData = Object.create(null);
    this.extraFiles = extraFiles;
    this.extraDirs = extraDirs;
  }
  run() {
    this.cloneRepo();
    this.readSrcFileData();
    this.addExtraFilesFromDirs();
    this.addSpecificFiles();
    this.writeTsConfig();
    this.writeSrcFileData();
  }

  cloneRepo() {
    if (fs.existsSync(this.repoDir)) return;
    console.info(`Cloning src data repository to ${this.repoDir}`);
    spawnSync("git", ["clone", this.repoUrl, this.repoDir]);
  }

  readSrcFileData() {
    const patterns = [`${this.srcFolder}/**/*.ts`, `${this.srcFolder}/**/*.d.ts`, `${this.srcFolder}/*.d.ts`];
    patterns.forEach(pattern => {
      const files = globSync(pattern, { cwd: this.repoDir, nodir: true });
      files.forEach(file => {
        const filePath = path.join(this.repoDir, file);
        const relativePath = path.relative(this.repoDir, filePath).toLowerCase();
        const fileContents = fs.readFileSync(filePath, "utf8");
        this.addFileContents(relativePath, fileContents);
      });
    });
  }

  addExtraFilesFromDirs() {
    this.extraDirs.forEach(({ dir, nameOnly = false }) => {
      const absoluteSourceDir = path.resolve(__dirname, dir);
      let allFiles = globSync("**/*.d.ts", { cwd: absoluteSourceDir, nodir: true });
      allFiles = allFiles.concat(globSync("**/*.d.mts", { cwd: absoluteSourceDir, nodir: true }));

      allFiles.forEach(file => {
        const filePath = path.join(absoluteSourceDir, file);
        let relativePath = path.join(dir, path.relative(absoluteSourceDir, filePath));
        if (nameOnly) {
          relativePath = path.basename(relativePath);
        }
        this.addFileContents(relativePath, fs.readFileSync(filePath, "utf8"))
      });
    });
  }

  addFileContents(relativePath, fileContents) {
    if (relativePath in this.srcFileData) {
        if (this.srcFileData[relativePath] !== fileContents) {
          throw new Error(`${relativePath} was previously added with different contents.`);
        }
    } else {
      this.srcFileData[relativePath] = fileContents;
    }
  }

  addSpecificFiles() {
    this.extraFiles.forEach(file => {
      const filePath = path.join(this.baseDir, file);
      this.srcFileData[file] = fs.readFileSync(filePath, "utf8");
    });
  }

  writeSrcFileData() {
    const filesDataPath = path.join(this.outputDir, "files.json");
    fs.writeFileSync(
      filesDataPath,
      JSON.stringify(this.srcFileData, null, 2)
    );
    const stats = fs.statSync(filesDataPath);
    const fileSizeInKiB = (stats.size / 1024) | 0;
    console.info(`Exported ${this.projectName}`);
    console.info(`   File Contents: ${path.relative(process.cwd(), filesDataPath)}`);
    console.info(`   Total Size:    ${fileSizeInKiB} KiB`);
  }

  writeTsConfig() {
    const tsconfigInputPath = path.join(this.repoDir, "tsconfig.json");
    const mergedTsconfig = this.loadAndMergeTsconfig(tsconfigInputPath);
    const tsconfigOutputPath = path.join(this.outputDir, "tsconfig.json");
    fs.writeFileSync(
      tsconfigOutputPath,
      JSON.stringify(mergedTsconfig, null, 2)
    );
  }

  loadAndMergeTsconfig(configPath) {
    const tsconfigContent = fs.readFileSync(configPath, "utf8");
    const tsconfigContentWithoutComments = tsconfigContent.replace(/(?:^|\s)\/\/.*$|\/\*[\s\S]*?\*\//gm, "");
    const tsconfig = JSON.parse(tsconfigContentWithoutComments);
    let baseConfigPath = tsconfig.extends;
    if (!baseConfigPath) return tsconfig;
    if (!baseConfigPath.startsWith('./') && !baseConfigPath.startsWith('../')) return tsconfig;

    baseConfigPath = path.resolve(path.dirname(configPath), baseConfigPath);
    const baseConfig = this.loadAndMergeTsconfig(baseConfigPath);
    
    const mergedConfig = { ...baseConfig, ...tsconfig };
    if (baseConfig.compilerOptions && tsconfig.compilerOptions) {
      mergedConfig.compilerOptions = { ...baseConfig.compilerOptions, ...tsconfig.compilerOptions };
    }
    delete mergedConfig.extends;
    return mergedConfig;
  }
}

const jest = new Importer({
  projectName: "jestjs-large",
  size: "large",
  repoUrl: "https://github.com/jestjs/jest.git",
  srcFolder: "packages",
  extraFiles: [
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
  ],
  extraDirs: [
    { dir: "../node_modules/@types/" },
    { dir: "../node_modules/typescript/lib/", nameOnly: true },
    { dir: "../node_modules/jest-worker/build/" },
    { dir: "../node_modules/@jridgewell/trace-mapping/types/" },
    { dir: "../node_modules/minimatch/dist/esm/" },
    { dir: "../node_modules/glob/dist/esm/" },
    { dir: "../../node_modules/tempy/node_modules/type-fest/source/" }
  ],
});

const zod = new Importer({
  projectName: "zod-medium",
  size: "medium",
  repoUrl: "https://github.com/colinhacks/zod.git",
  srcFolder: "packages",
  extraFiles: [],
  extraDirs: [
    { dir: "../node_modules/typescript/lib/", nameOnly: true },
  ],
});

const immer =new Importer({
  projectName: "immer-tiny",
  size: "tiny",
  repoUrl: "https://github.com/immerjs/immer.git",
  srcFolder: "src",
  extraFiles: [],
  extraDirs: [
    { dir: "../node_modules/typescript/lib/", nameOnly: true },
  ],
});

// Skip jest since it produces a hugh in-memory FS.
// jest.run();
zod.run();
immer.run();
