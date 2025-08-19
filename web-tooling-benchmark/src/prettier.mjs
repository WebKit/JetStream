// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as prettier from "prettier";

const payloads = [
  {
    name: "preact-8.2.5.js",
    options: { semi: false, useTabs: false, parser: "babel" }
  },
  {
    name: "lodash.core-4.17.4.js",
    options: { semi: true, useTabs: true, parser: "babel" }
  },
  {
    name: "todomvc/react/app.jsx",
    options: { semi: false, useTabs: true, parser: "babel" }
  },
  {
    name: "todomvc/react/footer.jsx",
    options: { jsxBracketSameLine: true, semi: true, useTabs: true, parser: "babel" }
  },
  {
    name: "todomvc/react/todoItem.jsx",
    options: { semi: false, singleQuote: true, useTabs: true, parser: "babel" }
  }
];

export default function runTest(fileData) {
  const testData = payloads.map(({ name, options }) => ({
    payload: fileData[name],
    options
  }));

  return testData.map(({ payload, options }) =>
    prettier.format(payload, options)
  );
}