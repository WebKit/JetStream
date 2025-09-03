import ts from "typescript";

const REPO_ROOT = "/User/test/JetStream/";

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
      const result = ts.resolveModuleName(
        moduleName,
        containingFile,
        this.options,
        this
      );
      if (result.resolvedModule) {
        resolvedModules.push(result.resolvedModule);
      } else {
        resolvedModules.push(undefined);
      }
    }
    return resolvedModules;
  }
  getDefaultLibFileName() {
    return "lib.d.ts";
  }
  getCurrentDirectory() {
    return "";
  }
  getCanonicalFileName(fileName) {
    return fileName.toLowerCase();
  }
  useCaseSensitiveFileNames() {
    return true;
  }
  getNewLine() {
    return "\n";
  }
  fileExists(filePath) {
    return filePath in this.srcFileData;
  }
  readFile(filePath) {
    const fileContent = this.srcFileData[filePath.toLowerCase()];
    if (fileContent === undefined) {
      throw new Error(`"${filePath}" does not exist.`);
    }
    return fileContent;
  }
  writeFile(fileName, data, writeByteOrderMark) {
    this.outFileData[fileName] = data;
  }
}

export function compileTest(tsConfig, srcFileData) {
  const options = ts.convertCompilerOptionsFromJson(
    tsConfig.compilerOptions,
    REPO_ROOT
  ).options;
  options.lib = [...(options.lib || []), "dom"];
  const host = new CompilerHost(options, srcFileData);
  const program = ts.createProgram(Object.keys(srcFileData), options, host);
  const emitResult = program.emit();
  const diagnostics = formatDiagnostics(program, emitResult);
  return {
    diagnostics,
    resultFilesCount: Object.keys(host.outFileData).length,
  };
}

function formatDiagnostics(program, emitResult) {
  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);
  if (allDiagnostics.length > 0) {
    console.log(`Found ${allDiagnostics.length} errors:`);
  }
  const formattedDiagnostics = allDiagnostics.map((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        "\n"
      );
      return `${diagnostic.file.fileName} (${line + 1},${
        character + 1
      }): ${message}`;
    } else {
      return ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n");
    }
  });
  formattedDiagnostics.slice(0, 20).map((each) => console.log(each));
  return formattedDiagnostics;
}
