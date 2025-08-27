import path from "path";
import TerserPlugin from "terser-webpack-plugin";
import { LicenseFilePlugin } from "generate-license-file-webpack-plugin";
import { fileURLToPath } from "url";
import UnicodeEscapePlugin from "@dapplets/unicode-escape-webpack-plugin";
import CacheBusterPlugin from "../startup-helper/BabelCacheBuster.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createConfig({ es6, filename, minify }) {
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
          test: /\.m?js$/,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
              plugins: [CacheBusterPlugin],
            },
          },
        },
        {
          test: /\.c?js$/,
          include: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              plugins: [CacheBusterPlugin],
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
      minify: false,
    }),
    createConfig({
      es6: false,
      filename: "bundle.es5.min.js",
      minify: false,
    }),
  ];
};
