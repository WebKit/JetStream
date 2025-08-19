// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as CoffeeScript from "coffeescript";
import * as fs from "fs";

const input = fs.readFileSync(
  "third_party/coffeescript-lexer-2.0.1.coffee",
  "utf8"
);

export default {
  name: "coffeescript",
  fn() {
    return CoffeeScript.compile(input);
  }
};
