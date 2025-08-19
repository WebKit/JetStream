// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as jshint from "jshint";

const payloads = [
  "lodash.core-4.17.4.js",
  "preact-8.2.5.js",
  "underscore-1.8.3.js"
];

export default function runTest(fileData) {
  const testData = payloads.map(name => fileData[name]);
  return testData.forEach(input => jshint.JSHINT(input));
}