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
      library: {
        name: "D3Test",
        type: "globalThis",
      },
      libraryTarget: "assign",
    },
    plugins: [
      new webpack.ProvidePlugin({
        TextEncoder: [path.resolve(__dirname, "src/mock/text-encoding-mock.js"), "TextEncoder"],
        TextDecoder: [path.resolve(__dirname, "src/mock/text-encoding-mock.js"), "TextDecoder"],
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
      new webpack.BannerPlugin({
        banner: `For license information, please see ${filename}.LICENSE.txt`,
      }),
    ],
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
          extractComments: true,
        }),
      ],
    },
    resolve: {
      fallback: {
        "assert": require.resolve("assert/"),
        "buffer": require.resolve("buffer/"),
        "canvas": false,
        "child_process": false,
        "crypto": false,
        "fs": false,
        "http": require.resolve("stream-http"),
        "https": false,
        "net": false,
        "os": require.resolve("os-browserify/browser"),
        "path": require.resolve("path-browserify"),
        "stream": require.resolve("stream-browserify"),
        "tls": false,
        "url": require.resolve("url/"),
        "util": require.resolve("util/"),
        "vm": false, 
        "zlib": false, 
      },
    },
    performance: {
      hints: false
    },
  };
};

module.exports = [
  createConfig({ filename: "d3-test.minified.js", minify: true }),
  createConfig({ filename: "d3-test.js", minify: false })
];