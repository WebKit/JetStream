// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import * as sourceMap from "source-map";

const payloads = [
  "lodash.min-4.17.4.js.map",
  "preact-8.2.5.js.map",
  "source-map.min-0.5.7.js.map",
  "underscore.min-1.8.3.js.map"
];

export async function runTest(fileData) {
  const testData = payloads.map(name => fileData[name]);

  sourceMap.SourceMapConsumer.initialize({
    "lib/mappings.wasm": fileData["source-map/lib/mappings.wasm"],
  });

  for (const payload of testData) {
    // Parse the source map first...
    const smc = await new sourceMap.SourceMapConsumer(payload);
    // ...then serialize the parsed source map to a String.
    const smg = sourceMap.SourceMapGenerator.fromSourceMap(smc);

    // Create a SourceNode from the generated code and a SourceMapConsumer.
    const fswsm = await sourceMap.SourceNode.fromStringWithSourceMap(
      payload,
      smc
    );

    return [smg.toString(), fswsm.toString()];
  }
}