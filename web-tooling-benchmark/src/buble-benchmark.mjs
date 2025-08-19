// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as buble from "buble";
import * as fs from "fs";

const payloads = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: {}
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options: { transforms: { modules: false } }
}));

export default {
  name: "buble",
  fn() {
    return payloads.map(({ payload, options }) =>
      buble.transform(payload, options)
    );
  }
};
