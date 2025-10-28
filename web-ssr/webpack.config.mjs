import path from "path";
import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";
import UnicodeEscapePlugin  from "@dapplets/unicode-escape-webpack-plugin";
import { LicenseWebpackPlugin } from "license-webpack-plugin";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      new UnicodeEscapePlugin({
        test: /\.(js|jsx|ts|tsx)$/, // Escape Unicode in JavaScript and TypeScript files
      }),
      new LicenseWebpackPlugin({
        perChunkOutput: true, 
        outputFilename: "LICENSE.txt",
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
              plugins: [path.resolve(__dirname, "../utils/BabelCacheBuster.mjs")],
            },
          },
        },
        {
          test: /\.c?js$/,
          include: path.resolve(__dirname, "node_modules"),
          use: {
            loader: "babel-loader",
            options: {
              plugins: [path.resolve(__dirname, "../utils/BabelCacheBuster.mjs")],
            },
          },
        },
      ],
    },
    optimization: {
      minimizer: [
        new TerserPlugin({
          extractComments: false,
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
        "assert": path.resolve("assert/"),
        "buffer": path.resolve("buffer/"),
        "canvas": false,
        "child_process": false,
        "crypto": false,
        "fs": false,
        "http": false,
        "https": false,
        "net": false,
        "os": false,
        "path": path.resolve("path-browserify"),
        "stream": path.resolve("stream-browserify"),
        "string_decoder": path.resolve("string_decoder/"),
        "tls": false,
        "url": path.resolve("url/"),
        "util": path.resolve("util/"),
        "vm": false,
        "zlib": false,
      }
    },
    performance: {
      hints: false
    },
  };
};



export default [
  createConfig({ filename: "bundle.min.js", minify: true }),
  createConfig({ filename: "bundle.js", minify: false })
];
