const ts = require('typescript');
const path = require('path');
const fileContents = require('./gen/src_files_data.cjs');
const tsconfig = require('./gen/src_tsconfig.cjs');
const sys = require("sys");

const repoRoot = path.resolve(__dirname, '../jest');

function compileTest() {
  const options = ts.convertCompilerOptionsFromJson(tsconfig.compilerOptions, repoRoot).options;
  options.lib = [...(options.lib || []), 'dom'];

  const fakeFsCompilerHost = {
    getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile) {
      const fileContent = this.readFile(fileName);
      return ts.createSourceFile(fileName, fileContent, languageVersion);
    },
    resolveModuleNames(moduleNames, containingFile) {
      const resolvedModules = [];
      for (const moduleName of moduleNames) {
        // This is a simplified resolution. A real implementation would be more complex.
        const result = ts.resolveModuleName(moduleName, containingFile, options, this);
        if (result.resolvedModule) {
          resolvedModules.push(result.resolvedModule);
        } else {
          resolvedModules.push(undefined);
        }
      }
      return resolvedModules;
    },
    getDefaultLibFileName() { return "lib.d.ts"; },
    getCurrentDirectory() { return ""; },
    getCanonicalFileName(fileName) { return fileName; },
    useCaseSensitiveFileNames() { return true; },
    getNewLine() { return "\n"; },
    fileExists(filePath) {
      return filePath in fileContents;
    },
    readFile(filePath) {
      const fileContent = fileContents[filePath];
      if (fileContent === undefined) {
        throw new Error(`"${filePath}" does not exist.`);
      }
      return fileContent;
    },
  };

  console.log('Starting TypeScript in-memory compilation benchmark with Jest source...');

  const startTime = Date.now();

  const host = ts.createCompilerHostWorker(options, undefined, sys);
  if (!host) throw new Error("No host");
  console.log(Object.keys(fileContents))
  const program = ts.createProgram(Object.keys(fileContents), options, fakeFsCompilerHost);
  const emitResult = program.emit();

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  if (allDiagnostics.length > 0) {
    console.log(`Found ${allDiagnostics.length} errors:`);
  }

  allDiagnostics.slice(0, 20).forEach(diagnostic => { // Limit output for brevity
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(diagnostic.file, diagnostic.start);
      const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
      console.log(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
    } else {
      console.log(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  });

  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;

  console.log(`TypeScript compilation finished.`);
  console.log(`Compilation took ${duration.toFixed(2)} seconds.`);

  if (emitResult.emitSkipped) {
    console.log('Emit was skipped.');
  }
}

module.exports = {
  compileTest
};