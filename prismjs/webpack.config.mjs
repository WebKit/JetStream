import path from "path";
import { fileURLToPath } from "url";
import TerserPlugin from "terser-webpack-plugin";
import CacheBusterCommentPlugin from "../utils/BabelCacheBuster.mjs";
import UnicodeEscapePlugin from "@dapplets/unicode-escape-webpack-plugin";
import { LicenseWebpackPlugin } from "license-webpack-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
    plugins: [
      new UnicodeEscapePlugin({
        test: /\.(js|jsx|ts|tsx)$/, // Escape Unicode in JavaScript and TypeScript files
      }),
      new LicenseWebpackPlugin({
        perChunkOutput: true, 
        outputFilename: "LICENSE.txt",
      })
    ],
    resolve: {
      fallback: {},
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
  };
}

export default [
  config({ filename: "bundle.es6.min.js", minify: true, target: "es6" }),
  config({ filename: "bundle.es6.js", minify: false, target: "es6" }),
  config({ filename: "bundle.es5.min.js", minify: true, target: "es5" }),
  config({ filename: "bundle.es5.js", minify: false, target: "es5" }),
];
