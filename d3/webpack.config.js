const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

function createConfig({ filename, minify }) {
  return {
    mode: "production",
    devtool: "source-map",
    target: "web",
    entry: "./src/test.mjs",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: filename,
      library: "d3Test",
      libraryTarget: "umd",
      globalObject: "this",
    },
    module: {
      rules: [
        {
          test: /\.c?js$/,
          exclude: path.resolve(__dirname, "src/data"),
          use: {
            loader: "babel-loader",
            options: {
              plugins: [path.resolve(__dirname, "build/cache-buster-comment-plugin.cjs")],
            },
          },
        },
      ]
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
    resolve: {
      fallback: {
        "path": require.resolve("path-browserify"),
        "fs": false,
        "https": false,
        "http": false,
        "net": false,
        "tls": false,
        "url": false,
        "assert": false,
        "buffer": false,
        "vm": false,
        "crypto": false,
        "stream": false,
        "zlib": false,
        "util": false,
        "os": false,
        "child_process": false,
        "canvas": false
      },
    },
  };
};

module.exports = [
  createConfig({ filename: "d3.minified.js", minify: true }),
  createConfig({ filename: "d3.js", minify: false })
];