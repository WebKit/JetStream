// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

const path = require("path");

import { targetList } from ".src/cli-flags-helper.mjs";
const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");

async function getTargets(env) {
  const only = env && env.only;
  if (only && targetList.has(only)) {
    return [only];
  }
  return [...targetList];
}

module.exports = async env => {
  const targets = await getTargets(env);

  const entry = targets.reduce((acc, name) => {
    acc[name] = path.join(srcDir, `${name}.mjs`);
    return acc;
  }, {});

  return [
    {
      entry,
      output: {
        path: distDir,
        filename: "[name].js"
      },
      mode: "development",
      devtool: false
    },
    {
      entry,
      output: {
        path: distDir,
        filename: "[name].min.js"
      },
      mode: "production"
    }
  ];
};
