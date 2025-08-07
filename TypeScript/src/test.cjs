const ts = require('typescript');
const path = require('path');
const fileContents = require('./jest_src_data.cjs');
const tsconfig = require('./jest_tsconfig.cjs');

const repoRoot = path.resolve(__dirname, '../jest');

function compileTest() {
  const options = ts.convertCompilerOptionsFromJson(tsconfig.compilerOptions, repoRoot).options;
  options.lib = [...(options.lib || []), 'dom'];

  const customCompilerHost = (options, host) => {
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const relativePath = path.relative(repoRoot, fileName);
      const fileContent = fileContents[relativePath];
      if (fileContent) {
        return ts.createSourceFile(fileName, fileContent, languageVersion);
      }
      // Fallback for files not in our in-memory object (like DOM libs, etc.)
      const fileContentOnDisk = ts.sys.readFile(fileName);
      if (fileContentOnDisk !== undefined) {
        return ts.createSourceFile(fileName, fileContentOnDisk, languageVersion);
      }
      return ts.createSourceFile(fileName, '', languageVersion);
    };

    host.resolveModuleNames = (moduleNames, containingFile) => {
      const resolvedModules = [];
      for (const moduleName of moduleNames) {
        // This is a simplified resolution. A real implementation would be more complex.
        const result = ts.resolveModuleName(moduleName, containingFile, options, ts.sys);
        if (result.resolvedModule) {
          resolvedModules.push(result.resolvedModule);
        } else {
          resolvedModules.push(undefined);
        }
      }
      return resolvedModules;
    };

    host.getCanonicalFileName = (fileName) => fileName;
    host.useCaseSensitiveFileNames = () => ts.sys.useCaseSensitiveFileNames;
    host.getNewLine = () => ts.sys.newLine;
    host.fileExists = (fileName) => {
        const relativePath = path.relative(repoRoot, fileName);
        return fileContents[relativePath] !== undefined || ts.sys.fileExists(fileName);
    }
    host.readFile = (fileName) => {
        const relativePath = path.relative(repoRoot, fileName);
        return fileContents[relativePath] || ts.sys.readFile(fileName);
    }

    return host;
  };

  console.log('Starting TypeScript in-memory compilation benchmark with Jest source...');

  const startTime = Date.now();

  const host = ts.createCompilerHost(options);
  const program = ts.createProgram(Object.keys(fileContents).map(f => path.join(repoRoot, f)), options, customCompilerHost(options, host));
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

compileTest();

