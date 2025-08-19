// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as espree from "espree";

const payloads = [
  "backbone-1.1.0.js",
  "jquery-3.2.1.js",
  "mootools-core-1.6.0.js",
  "underscore-1.8.3.js"
];

export default function runTest(fileData) {
  const testData = payloads.map(name => fileData[name]);

  return testData.map(payload => {
    let count = 0;
    count += espree.tokenize(payload, { loc: true, range: true }).length;
    count += espree.parse(payload, { loc: true, range: true }).body.length;
    return count;
  });
}