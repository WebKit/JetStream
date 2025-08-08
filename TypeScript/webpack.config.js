const path = require("path");
const webpack = require("webpack");

const commonConfig = {
  mode: "production",
  devtool: "source-map",
  target: "web",
  entry: path.resolve(__dirname, "src/test.cjs"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "typescript-compile-test.js",
    library: {
      name: "TypeScriptCompileTest",
      type: "globalThis",
    },
    libraryTarget: "assign",
  },
  resolve: {
    fallback: {
       "path": require.resolve("path-browserify"),
       "fs": false,
    },
  },
};


module.exports = [commonConfig];
