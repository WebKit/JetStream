import path from "path";
import TerserPlugin from "terser-webpack-plugin";
import { LicenseFilePlugin } from "generate-license-file-webpack-plugin";
import { fileURLToPath } from "url";
import UnicodeEscapePlugin from "@dapplets/unicode-escape-webpack-plugin";
import CacheBusterPlugin from "../utils/BabelCacheBuster.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createConfig({ es6, filename, minify }) {
  let babelPlugins = []
  let babelTargets = { chrome: "100" }
  if (!es6) {
    // enable loose class definitions for es5 (e.g. with prototype assignments)
    babelPlugins = [["@babel/plugin-transform-classes", { loose: true }],];
    // Use a reasonably ok pre-es6 classes browser.
    babelTargets = { chrome: "40" };
  }
  return {
    entry: "./src/babylon-js-benchmark.mjs",
    mode: "production",
    devtool: "source-map",
    target: ["web", es6 ? "es6" : "es5"],
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: filename,
      library: {
        name: "BabylonJSBenchmark",
        type: "globalThis",
      },
      libraryTarget: "assign",
      chunkFormat: "commonjs",
    },
    module: {
      rules: [
        {
          test: /\.[cm]?js$/,
          use: {
            loader: "babel-loader",
            options: {
              presets: [
                [
                  "@babel/preset-env",
                  { targets: babelTargets},
                ],
              ],
              plugins: [
                CacheBusterPlugin, ...babelPlugins
              ],
            },
          },
        },
      ],
    },
    plugins: [
      new LicenseFilePlugin({
        outputFileName: "LICENSE.txt",
      }),
      new UnicodeEscapePlugin({
        test: /\.(js|jsx|ts|tsx)$/, // Escape Unicode in JavaScript and TypeScript files
      }),
    ],
    optimization: {
      minimizer: [
        new TerserPlugin({
          extractComments: false,
          terserOptions: {
            mangle: minify,
            format: {
              // Keep this comment for cache-busting.
              comments: /@preserve|@license|@cc_on|ThouShaltNotCache/i,
            },
          },
        }),
      ],
    },
    resolve: {
      fallback: {
        assert: "assert/",
        fs: false,
        path: "path-browserify",
      },
    },
  };
}

export default (env, argv) => {
  const isDevelopment = argv.mode === "development";

  const nonMinifiedConfigs = [
    createConfig({
      es6: true,
      filename: "bundle.es6.js",
      minify: false,
    }),
    createConfig({
      es6: false,
      filename: "bundle.es5.js",
      minify: false,
    }),
  ];

  if (isDevelopment) {
    return nonMinifiedConfigs;
  }

  return [
    createConfig({
      es6: true,
      filename: "bundle.es6.min.js",
      minify: true,
    }),
    createConfig({
      es6: false,
      filename: "bundle.es5.min.js",
      minify: true,
    }),
  ];
};
