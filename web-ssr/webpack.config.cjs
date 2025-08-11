const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");

function createConfig({filename, minify}) {
  return {
    mode: "production",
    devtool: "source-map",
    target: "web",
    entry: path.resolve(__dirname, "src/react-render-test.cjs"),
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
              plugins: [path.resolve(__dirname, "build/jetstream-comment-plugin.js")],
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
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        "url": require.resolve("url/"),
        "assert": require.resolve("assert/"),
        "string_decoder": require.resolve("string_decoder/"),
        "path": require.resolve("path-browserify"),
        "vm": require.resolve("vm-browserify"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "zlib": require.resolve("browserify-zlib"),
        "util": require.resolve("util/"),
        "os": require.resolve("os-browserify/browser"),
        "buffer": require.resolve("buffer/"),
        "fs": false,
        "child_process": false,
        "net": false,
        "tls": false,
        "canvas": false,
      }
    },
    performance: {
      hints: false
    },
  };
};



module.exports = [
    createConfig({filename: "react-render-test.minified.js", minify: true}),
    createConfig({filename: "react-render-test.js", minify: false})
];