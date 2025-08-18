const path = require("path");
const webpack = require("webpack");

function config({ filename, minify }) {
  return {
    entry: "./src/test.mjs",
    mode: "production",
    devtool: "source-map",
    target: "web",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: filename,
      library: {
        name: "ValidatorJSBenchmark",
        type: "globalThis",
      },
      libraryTarget: "assign",
      chunkFormat: "commonjs",
    },
    optimization: {
      minimize: minify,
    },
  };
}

module.exports = [
  config({ filename: "bundle.es6.min.js", minify: true }),
  config({ filename: "bundle.es6.js", minify: false }),
];
