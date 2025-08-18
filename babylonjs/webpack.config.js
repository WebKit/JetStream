const { create } = require("domain");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");
const { LicenseFilePlugin } = require("generate-license-file-webpack-plugin");

function createConfig({es6, filename, minify }) {
   const cacheBuster = path.resolve(__dirname, "build/cache-buster-comment-plugin.cjs");
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
                plugins: [cacheBuster],
              }
            }
          },
          {
            test: /\.c?js$/,
            include: /node_modules/,
            use: {
              loader: "babel-loader",
              options: {
                plugins: [cacheBuster],
              },
            },
          },
        ]
      },
      plugins: [
        new LicenseFilePlugin({
          outputFileName: "LICENSE.txt",
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
          "assert": require.resolve("assert/"),
          "fs": false,
          "path": require.resolve("path-browserify"),
        },
      },
    };
}



module.exports = (env, argv) => {
  const isDevelopment = argv.mode === 'development';

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