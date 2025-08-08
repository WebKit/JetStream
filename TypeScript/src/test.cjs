const ts = require("typescript");
const path = require("path");
const SRC_FILE_DATA = require("./gen/immer-tiny/src_file_data.cjs");
const TS_CONFIG = require("./gen/immer-tiny/src_tsconfig.cjs");

const repoRoot = path.resolve(__dirname, "../jest");

class CompilerHost {
  constructor(options, srcFileData) {
    this.options = options;
    this.srcFileData = srcFileData;
    this.outFileData = Object.create(null);
  }

  getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
    const fileContent = this.readFile(fileName);
    return ts.createSourceFile(fileName, fileContent, languageVersion);
  }

  resolveModuleNames(moduleNames, containingFile) {
    const resolvedModules = [];
    for (const moduleName of moduleNames) {
      const result = ts.resolveModuleName(moduleName, containingFile, this.options, this);
      if (result.resolvedModule) {
        resolvedModules.push(result.resolvedModule);
      } else {
        resolvedModules.push(undefined);
      }
    }
    return resolvedModules;
  }

  getDefaultLibFileName() { return "lib.d.ts"; }
  getCurrentDirectory() { return ""; }
  getCanonicalFileName(fileName) { return fileName; }
  useCaseSensitiveFileNames() { return true; }
  getNewLine() { return "\n"; }

  fileExists(filePath) {
    return filePath in this.srcFileData;
  }

  readFile(filePath) {
    const fileContent = this.srcFileData[filePath];
    if (fileContent === undefined) {
      throw new Error(`"${filePath}" does not exist.`);
    }
    return fileContent;
  }

  writeFile(fileName, data, writeByteOrderMark) {
    this.outFileData[fileName] = data;
  }
}

function compileTest() {
  const options = ts.convertCompilerOptionsFromJson(TS_CONFIG.compilerOptions, repoRoot).options;
  options.lib = [...(options.lib || []), "dom"];

  const host = new CompilerHost(options, SRC_FILE_DATA);

  console.log("Starting TypeScript in-memory compilation benchmark with Jest source...");
  const startTime = performance.now();

  const program = ts.createProgram(Object.keys(SRC_FILE_DATA), options, host);
  const emitResult = program.emit();

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  if (allDiagnostics.length > 0) {
    console.log(`Found ${allDiagnostics.length} errors:`);
  }

  allDiagnostics.slice(0, 20).forEach(diagnostic => { // Limit output for brevity
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    }
  });

  const endTime = performance.now();
  const duration = (endTime - startTime) / 1000;

  console.log(`TypeScript compilation finished.`);
  console.log(`Compilation took ${duration.toFixed(2)} seconds.`);

  if (emitResult.emitSkipped) {
    console.log("Emit was skipped.");
  }
}

module.exports = {
  compileTest
};