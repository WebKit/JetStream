// Copyright 2023 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Crude polyfills for missing browser APIs in JavaScript shells.

console = {
  log: print,
  error: print,
  debug: print,
  warn: print,
};

// `TextEncoder` and `TextDecoder`. These are called only a few times with short
// ASCII strings, so this is sufficient and not performance-critical.
class TextEncoder {
  encode(string) {
    return Uint8Array.from(string, (char) => {
      let byte = char.codePointAt(0);
      if (byte > 0x7f)
        throw new Error("TextEncoder polyfill only supports ASCII");
      return byte;
    });
  }
}
class TextDecoder {
  decode(array) {
    for (let byte of array) {
      if (byte > 0x7f)
        throw new Error("TextDecoder polyfill only supports ASCII");
    }
    return String.fromCharCode.apply(null, array);
  }
}

// `crypto.getRandomValues`. This is called only once during setup.
// The implementation is copied from an Emscripten error message proposing this.
var crypto = {
  getRandomValues: (array) => {
    for (var i = 0; i < array.length; i++) array[i] = (Math.random() * 256) | 0;
  },
};

// Empty `URLSearchParams` has just the same interface as a `Map`.
var URLSearchParams = Map;

// `self` global object.
var self = this;

// Exports `sqlite3InitModule()` and contains the main code.
load("build/jswasm/speedtest1.js");

// Load Wasm binary from disk.
var Module = { wasmBinary: read("build/jswasm/speedtest1.wasm", "binary") };

// Heavily simplified from inline JavaScript in `speedtest1.html`.
function runTests(sqlite3Module) {
  const wasm = sqlite3Module.wasm;
  // Required for `scopedAllocMainArgv()`.
  wasm.scopedAllocPush();
  // This should match the browser version at `speedtest1.html`.
  let argv = [
    "--singlethread",
    //"--nomutex",
    //"--nosync",
    //"--memdb", // note that memdb trumps the filename arg
    "--nomemstat",
    "--big-transactions" /*important for tests 410 and 510!*/,
    "--size", "20", // To speedup, default is 100 (and takes about 4s).
  ];
  console.log("Calling main with argv:\n ", argv);
  wasm.xCall("wasm_main", argv.length, wasm.scopedAllocMainArgv(argv));
  wasm.scopedAllocPop();
}

sqlite3InitModule(Module).then(runTests);
