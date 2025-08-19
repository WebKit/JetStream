// Copyright 2018 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import babelMinify from "babel-minify";
import * as fs from "fs";

const payloads = [
  {
    name: "speedometer-es2015-test-2.0.js",
    options: {}
  }
].map(({ name, options }) => ({
  payload: fs.readFileSync(`third_party/${name}`, "utf8"),
  options
}));

export default {
  name: "babel-minify",
  fn() {
    return payloads.map(({ payload, options }) =>
      babelMinify(payload, options)
    );
  }
};
