  function fileExists(path) {
    return false;
  }
  function readFile(path, encoding) {
    return undefined;
  }
  var sys = {
    args: [],
    newLine: "\n",
    useCaseSensitiveFileNames: true,
    write: function (s) {
    },
    writeOutputIsTTY: function () {
      return false;
    },
    readFile: readFile,
    fileExists: fileExists,
    exit: function (exitCode) {
    },
    getExecutingFilePath: function () {
      return "./";
    },
    getCurrentDirectory: function () {
      return "./";
    },
    getModifiedTime: function (path) {
      return undefined;
    },
    createDirectory: function (path) {
    },
    deleteFile: function (path) {
    },
  };
