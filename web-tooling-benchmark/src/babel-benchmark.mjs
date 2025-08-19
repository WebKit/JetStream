// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as Babel from "@babel/standalone";
import * as babylon from "babylon";
import * as fs from "fs";

const payloads = [
  {
    name: "vue.runtime.esm-nobuble-2.4.4.js",
    options: { presets: ["es2015"], sourceType: "module" }
  }
].map(({ name, options }) => {
  const code = fs.readFileSync(`third_party/${name}`, "utf8");
  const ast = babylon.parse(code, options);
  return { ast, code, options };
});

export default {
  name: "babel",
  fn() {
    return payloads.map(({ ast, code, options }) =>
      Babel.transformFromAst(ast, code, options)
    );
  }
};
