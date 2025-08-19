const targetList = new Set([
  "acorn",
  "babel",
  "babel-minify",
  "babylon",
  "chai",
  "espree",
  "esprima-next",
  "jshint",
  "lebab",
  "postcss",
  "prepack",
  "prettier",
  "source-map",
  "terser",
  "typescript",
]);

function getOnlyFlag() {
  const onlyIndex = process.argv.indexOf("--only");
  if (onlyIndex != -1) {
    return process.argv[onlyIndex + 1];
  }
}

export default {
  getTarget: () => {
    const onlyArg = getOnlyFlag();
    if (targetList.has(onlyArg)) {
      return [onlyArg];
    } else if (typeof ONLY != "undefined" && targetList.has(ONLY)) {
      return [ONLY];
    } else {
      return [...targetList];
    }
  },
  targetList: targetList
};
