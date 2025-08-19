// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as prepack from "prepack";

const payloads = [
  "preact-8.2.5.js",
  "redux.min-3.7.2.js"
];

export default function runTest(fileData) {
  const sourceFiles = payloads.map(name => ({
    filePath: `third_party/${name}`,
    fileContents: fileData[name]
  }));

  return prepack.prepackSources(sourceFiles);
}