const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

function createConfig({ filename, minify }) {
  return {
    mode: "production",
    devtool: "source-map",
    target: "web",
    entry: "./src/react-render-test.cjs",
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: filename,
      library: {
        name: "ReactRenderTest",
        type: "globalThis",
      },
      libraryTarget: "assign",
    },
    plugins: [
      new webpack.ProvidePlugin({
        TextEncoder: ["text-encoding", "TextEncoder"],
        TextDecoder: ["text-encoding", "TextDecoder"],
        MessageChannel: [path.resolve(__dirname, "src/mock/message_channel.cjs"), "MessageChannel"],
        process: "process/browser",
        Buffer: ["buffer", "Buffer"],
      }),
    ],
    module: {
      rules: [
        {
          test: /\.c?js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                ["@babel/preset-env", {
                  // Keep ES6 classes.
                  exclude: ["@babel/plugin-transform-classes"]
                }],
                "@babel/preset-react"
              ],
              plugins: [path.resolve(__dirname, "build/cache-buster-comment-plugin.cjs")],
            },
          },
        },
        {
          test: /\.c?js$/,
          include: path.resolve(__dirname, "node_modules"),
          use: {
            loader: "babel-loader",
            options: {
              plugins: [path.resolve(__dirname, "build/cache-buster-comment-plugin.cjs")],
            },
          },
        },
      ],
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
        "assert": require.resolve("assert/"),
        "buffer": require.resolve("buffer/"),
        "canvas": false,
        "child_process": false,
        "crypto": false,
        "fs": false,
        "http": false,
        "https": false,
        "net": false,
        "os": false,
        "path": require.resolve("path-browserify"),
        "stream": require.resolve("stream-browserify"),
        "string_decoder": require.resolve("string_decoder/"),
        "tls": false,
        "url": require.resolve("url/"),
        "util": require.resolve("util/"),
        "vm": false,
        "zlib": false,
      }
    },
    performance: {
      hints: false
    },
  };
};



module.exports = [
  createConfig({ filename: "react-render-test.minified.js", minify: true }),
  createConfig({ filename: "react-render-test.js", minify: false })
];