import path from "path";
import { fileURLToPath } from "url";
import TerserPlugin from "terser-webpack-plugin";
import { LicenseFilePlugin } from "generate-license-file-webpack-plugin";

import CacheBusterCommentPlugin from "../utils/BabelCacheBuster.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        name: "MobXBenchmark",
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
    plugins: [new LicenseFilePlugin({
      outputFileName: "LICENSE.txt",
    })],
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

export default [
  config({ filename: "bundle.es6.min.js", minify: true, target: "es6" }),
  config({ filename: "bundle.es6.js", minify: false, target: "es6" }),
  config({ filename: "bundle.es5.min.js", minify: true, target: "es5" }),
  config({ filename: "bundle.es5.js", minify: false, target: "es5" }),
];
