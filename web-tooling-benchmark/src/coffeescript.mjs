// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as CoffeeScript from "coffeescript";

const payload = {
  name: "coffeescript-lexer-2.0.1.coffee"
};

export default function runTest(fileData) {
  const input = fileData[payload.name];
  return CoffeeScript.compile(input);
}