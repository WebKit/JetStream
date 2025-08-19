// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const webpack = require("webpack");
const targetList = require("./src/cli-flags-helper.mjs").targetList;

// function getTarget(env) {
//   return env && targetList.has(env.only) && env.only;
// }

module.exports = env => [
  {
    context: path.resolve("src"),
    entry: "./cli.mjs",
    output: {
      filename: "cli.js",
      path: path.resolve("dist")
    },
    bail: true,
    resolve: {
      alias: {
        fs: require.resolve("./src/vfs.mjs"),
        module: require.resolve("./src/mocks/dummy")
      }
    },
    plugins: [
      new webpack.BannerPlugin({
        banner:
          "// Required for JavaScript engine shells.\n" +
          "var global = this;\n" +
          "if (typeof console === 'undefined') {\n" +
          "  console = {log: print};\n" +
          "}",
        raw: true
      }),
      // new webpack.DefinePlugin({
      //   ONLY: JSON.stringify(getTarget(env))
      // })
    ]
  },
  {
    context: path.resolve("src"),
    entry: "./bootstrap.mjs",
    output: {
      filename: "browser.js",
      path: path.resolve("dist")
    },
    bail: true,
    resolve: {
      alias: {
        define: require.resolve("./src/mocks/dummy"),
        fs: require.resolve("./src/vfs.mjs"),
        module: require.resolve("./src/mocks/dummy")
      }
    },
    plugins: [
      new webpack.DefinePlugin({
        ONLY: JSON.stringify(getTarget(env))
      })
    ]
  }
];
