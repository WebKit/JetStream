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
    resolve: {
      fallback: {
        assert: require.resolve("assert/"),
        process: require.resolve("process/browser"),
      },
    },
    optimization: {
      minimize: minify,
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: "process/browser",
      }),
    ],
  };
}

module.exports = [
  config({ filename: "bundle.es6.min.js", minify: true }),
  config({ filename: "bundle.es6.js", minify: false }),
];
