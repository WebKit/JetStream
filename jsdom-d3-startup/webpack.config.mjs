import path from "path";
import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";
import UnicodeEscapePlugin from "@dapplets/unicode-escape-webpack-plugin";
import { LicenseWebpackPlugin } from "license-webpack-plugin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
          exclude: path.resolve(__dirname, "src/data"),
          use: {
            loader: "babel-loader",
            options: {
              plugins: [ "../startup-helper/BabelCacheBuster.mjs" ],
            },
          },
        },
      ]
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
        "assert": "assert/",
        "buffer": "buffer/",
        "canvas": false,
        "child_process": false,
        "crypto": false,
        "fs": false,
        "http": "stream-http",
        "https": false,
        "net": false,
        "os": "os-browserify/browser",
        "path": "path-browserify",
        "stream": "stream-browserify",
        "tls": false,
        "url": "url/",
        "util": "util/",
        "vm": false, 
        "zlib": false, 
      },
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