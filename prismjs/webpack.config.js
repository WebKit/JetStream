const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const CacheBusterCommentPlugin = require("./build/cache-buster-comment-plugin.cjs");

function config({ filename, minify, target }) {
  return {
    entry: "./src/test.mjs",
    mode: "production",
    devtool: "source-map",
    target: ["web", target],
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: filename,
      library: {
        name: "PrismJSBenchmark",
        type: "globalThis",
      },
      libraryTarget: "assign",
      chunkFormat: "commonjs",
    },
    module: {
      rules: [
        {
          test: /\.m?js$/,
          use: {
            loader: "babel-loader",
            options: {
              plugins: [CacheBusterCommentPlugin],
            },
          },
        },
      ],
    },
    plugins: [],
    resolve: {
      fallback: {},
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            mangle: minify,
            format: {
              // Keep this comment for cache-busting.
              comments: /ThouShaltNotCache/i,
            },
          },
        }),
      ],
    },
  };
}

module.exports = [
  config({ filename: "bundle.es6.min.js", minify: true, target: "es6" }),
  config({ filename: "bundle.es6.js", minify: false, target: "es6" }),
  config({ filename: "bundle.es5.min.js", minify: true, target: "es5" }),
  config({ filename: "bundle.es5.js", minify: false, target: "es5" }),
];
