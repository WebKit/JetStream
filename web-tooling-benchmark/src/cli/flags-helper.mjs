export const targetList = new Set([
  "acorn",
  "babel",
  "babel-minify",
  "babylon",
  "chai",
  "espree",
  "esprima-next",
  "lebab",
  "postcss",
  "prettier",
  // "rollup",
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

export function getTarget() {
  const onlyArg = getOnlyFlag();
  if (targetList.has(onlyArg)) {
    return [onlyArg];
  } else if (typeof ONLY != "undefined" && targetList.has(ONLY)) {
    return [ONLY];
  } else {
    return [...targetList];
  }
}
