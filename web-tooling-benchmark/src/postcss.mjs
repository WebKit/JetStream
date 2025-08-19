// Copyright 2018 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as fs from "fs";
import postcss from "postcss";
import nested from "postcss-nested";
import autoprefixer from "autoprefixer";
import nestedRules from "./mocks/nested-rules.mjs";

const cleaner = postcss([autoprefixer({ add: false, browsers: [] })]);
const processor = postcss([autoprefixer, nested]);

const payloads = [
  {
    name: "bootstrap-4.0.0.css",
    options: { from: `third_party/${this.name}`, map: false }
  },
  {
    name: "foundation-6.4.2.css",
    options: { from: `third_party/${this.name}`, map: false }
  },
  {
    name: "angular-material-1.1.8.css",
    options: { from: `third_party/${this.name}`, map: false }
  }
].map(({ name, options }) => {
  // Clean prefixes.
  const source = fs.readFileSync(`third_party/${name}`, "utf8");
  // Add some nested rules.
  const css = cleaner.process(source).css + nestedRules;

  return {
    payload: css,
    options
  };
});

export default {
  name: "postcss",
  fn() {
    return payloads.map(
      ({ payload, options }) => processor.process(payload, options).css
    );
  }
};
