// Copyright 2018 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import { ESLint } from "eslint";

const payloads = [
  {
    name: "preact-8.2.5.js"
  }
];

export default async function runTest(fileData) {
  const eslint = new ESLint({
    overrideConfigFile: true,
    overrideConfig: [
      {
        languageOptions: {
          ecmaVersion: 2022,
          sourceType: "module",
          globals: {
            es6: true,
            node: true,
          },
        },
        rules: {
          "no-unused-vars": "error",
          "no-undef": "error",
        },
      },
    ],
  });
  const testData = payloads.map(({ name }) => fileData[name]);

  return await Promise.all(
    testData.map((payload) => eslint.lintText(payload))
  );
}
