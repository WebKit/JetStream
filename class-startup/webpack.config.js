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
          name: "ClassesTest",
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
        minimize: minify,
        minimizer: [
            new TerserPlugin({
                extractComments: {
                    condition: /^\**!|@preserve|@license|@cc_on/i,
                    filename: `${filename}.LICENSE.txt`,
                    banner: (licenseFile) => {
                        return `License information can be found in ${licenseFile}`;
                    },
                },
            }),
        ],
      },
    };
}



module.exports = [
  createConfig({
    es6: true,
    filename: "classes.es6.js",
    minify: false,
  }),
  createConfig({
    es6: true,
    filename: "classes.es6.min.js",
    minify: true,
  }),
  createConfig({
    es6: false,
    filename: "classes.es5.js",
    minify: false,
  }),
  createConfig({
    es6: false,
    filename: "classes.es5.min.js",
    minify: true,
  }),
]