// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as acorn from "acorn";
import * as walk from "acorn-walk";

const payloads = [
  {
    name: "backbone-1.1.0.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "jquery-3.2.1.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "lodash.core-4.17.4.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "preact-8.2.5.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "redux.min-3.7.2.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "speedometer-es2015-test-2.0.js",
    options: { ecmaVersion: 6, sourceType: "script" }
  },
  {
    name: "underscore-1.8.3.js",
    options: { ecmaVersion: 5, sourceType: "script" }
  },
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { ecmaVersion: 7, sourceType: "module" }
  }
];

export default function runTest(fileData) {
  const testData = payloads.map(({ name, options }) => ({
    payload: fileData[name],
    options: Object.assign(options, { locations: true }, { ranges: true })
  }));

  return testData.map(({ payload, options }) => {
    let count = 0;

    // Test the tokenizer by counting the resulting tokens.
    for (const token of acorn.tokenizer(payload, options)) {
      count++;
    }

    // Test the parser.
    const ast = acorn.parse(payload, options);

    // Test the AST walker.
    walk.full(ast, node => count++);
    return count;
  });
}