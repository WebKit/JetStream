// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Babel from "@babel/standalone";
import * as babylon from "babylon";

const payloads = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { presets: ["es2015"], sourceType: "module" }
  }
];

export default function runTest(fileData) {
  const testData = payloads.map(({ name, options }) => {
    const code = fileData[name];
    const ast = babylon.parse(code, options);
    return { ast, code, options };
  });

  return testData.map(({ ast, code, options }) =>
    Babel.transformFromAst(ast, code, options)
  );
}