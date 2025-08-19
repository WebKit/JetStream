// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const path = require("path");
const { targetList } = require("./src/cli-flags-helper.mjs");

const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");

function getTargets(env) {
  const only = env && env.only;
  if (only && targetList.has(only)) {
    return [only];
  }
  return [...targetList];
}

module.exports = async env => {
  const targets = getTargets(env);
  const entries = {};
  for (const target of targets) {
    entries[target] = path.join(srcDir, `${target}.mjs`);
  }

  return [
    {
      entry: entries,
      output: {
        path: distDir,
        filename: "[name].js"
      },
      mode: "development",
      devtool: false
    },
    // {
    //   entry: entries,
    //   output: {
    //     path: distDir,
    //     filename: "[name].min.js"
    //   },
    //   mode: "production"
    // }
  ];
};
