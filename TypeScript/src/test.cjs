const ts = require('typescript');
const path = require('path');
const fileContents = require('./jets_src');
const tsconfig = require('./jets_tsconfig');

function compileTest() {
  const options = ts.convertCompilerOptionsFromJson(tsconfig.compilerOptions, __dirname).options;
  // Add DOM library for Jest
  options.lib = [...(options.lib || []), 'dom'];


  const customCompilerHost = (options, host) => {
    host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
      const filePath = path.normalize(fileName);
      const fileContent = fileContents[filePath];
      if (fileContent) {
        return ts.createSourceFile(fileName, fileContent, languageVersion);
      }
      const fileContentOnDisk = ts.sys.readFile(fileName);
      if (fileContentOnDisk !== undefined) {
        return ts.createSourceFile(fileName, fileContentOnDisk, languageVersion);
      }
      return ts.createSourceFile(fileName, '', languageVersion); // Return empty source file if not found on disk either
    };

    host.resolveModuleNames = (moduleNames, containingFile) => {
      const resolvedModules = [];
      for (const moduleName of moduleNames) {
        // Try to resolve from in-memory files first
        const resolvedFileName = path.resolve(path.dirname(containingFile), moduleName) + '.ts';
        if (fileContents[resolvedFileName]) {
          resolvedModules.push({ resolvedFileName });
          continue;
        }

        // Fallback to node module resolution
        const result = ts.resolveModuleName(moduleName, containingFile, options, ts.sys);
        if (result.resolvedModule) {
          resolvedModules.push(result.resolvedModule);
        } else {
          resolvedModules.push(undefined);
        }
      }
      return resolvedModules;
    };

    host.getCanonicalFileName = (fileName) => path.normalize(fileName);
    host.useCaseSensitiveFileNames = () => false;
    host.getNewLine = () => '\n';
    host.fileExists = (fileName) => {
        const normalized = path.normalize(fileName);
        return fileContents[normalized] !== undefined || ts.sys.fileExists(normalized);
    }
    host.readFile = (fileName) => {
        const normalized = path.normalize(fileName);
        return fileContents[normalized] || ts.sys.readFile(normalized);
    }

    return host;
  };

  console.log('Starting TypeScript compilation benchmark with Jest source...');

  const startTime = Date.now();

  const host = ts.createCompilerHost(options);
  const program = ts.createProgram(Object.keys(fileContents), options, customCompilerHost(options, host));
  const emitResult = program.emit();

  const allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

  allDiagnostics.forEach(diagnostic => {
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
