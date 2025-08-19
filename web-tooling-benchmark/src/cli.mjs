// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import suite from "./suite.mjs";
import cliFlags from "./cli-flags-helper.mjs";
import fileData from "./file-data.mjs";

const targets = cliFlags.getTarget();

for (const target of targets) {
  const benchmark = await import(`./${target}.mjs`);
  suite.add({
    name: target,
    fn: () => benchmark.default(fileData)
  });
}

suite.run({
  async: true
});