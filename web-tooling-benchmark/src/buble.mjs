// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as buble from "buble";

const payloads = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: {}
  }
];

export default function runTest(fileData) {
  const testData = payloads.map(({ name, options }) => ({
    payload: fileData[name],
    options: { transforms: { modules: false } }
  }));

  return testData.map(({ payload, options }) =>
    buble.transform(payload, options)
  );
}