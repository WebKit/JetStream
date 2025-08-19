// Copyright 2018 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import postcss from "postcss";
import nested from "postcss-nested";
import autoprefixer from "autoprefixer";
import nestedRules from "./mocks/nested-rules.mjs";

const cleaner = postcss([autoprefixer({ add: false, browsers: [] })]);
const processor = postcss([autoprefixer, nested]);

const payloads = [
  {
    name: "bootstrap-4.0.0.css",
    options: { from: `third_party/bootstrap-4.0.0.css`, map: false }
  },
  {
    name: "foundation-6.4.2.css",
    options: { from: `third_party/foundation-6.4.2.css`, map: false }
  },
  {
    name: "angular-material-1.1.8.css",
    options: { from: `third_party/angular-material-1.1.8.css`, map: false }
  }
];

export default function runTest(fileData) {
  const testData = payloads.map(({ name, options }) => {
    // Clean prefixes.
    const source = fileData[name];
    // Add some nested rules.
    const css = cleaner.process(source).css + nestedRules;

    return {
      payload: css,
      options
    };
  });

  return testData.map(
    ({ payload, options }) => processor.process(payload, options).css
  );
}