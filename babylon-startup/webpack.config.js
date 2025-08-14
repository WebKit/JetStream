const { create } = require("domain");
const path = require("path");
const TerserPlugin = require("terser-webpack-plugin");


function createConfig({es6, filename, minify }) {
   return {
      entry: "./src/test.mjs",
      mode: "production",
      devtool: "source-map",
      output: {
        path: path.resolve(__dirname, "dist"),
        filename: filename,
        library: {
          name: "ClassStartupTest",
          type: "globalThis",
        },
        libraryTarget: "assign",
        chunkFormat: "commonjs",
      },
      target: es6 ? "es6" : "es5",
      module: {
        rules: [
          {
            test: /\.m?js$/,
            exclude: /(node_modules|bower_components)/,
            use: {
              loader: "babel-loader",
              options: {
                presets: ["@babel/preset-env"],
                plugins: [path.resolve(__dirname, "build/cache-buster-comment-plugin.cjs")],
              }
            }
          },
          {
            test: /\.c?js$/,
            include: /node_modules/,
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
          }),
        ],
      },
    };
}



module.exports = [
  // Non-minified sources for better profiling
  // createConfig({
  //   es6: true,
  //   filename: "startup.es6.js",
  //   minify: false,
  // }),
  createConfig({
    es6: true,
    filename: "startup.es6.min.js",
    minify: true,
  }),
  // Non-minified sources for better profiling
  // createConfig({
  //   es6: false,
  //   filename: "startup.es5.js",
  //   minify: false,
  // }),
  createConfig({
    es6: false,
    filename: "startup.es5.min.js",
    minify: true,
  }),
]