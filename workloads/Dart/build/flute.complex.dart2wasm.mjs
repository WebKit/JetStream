// Compiles a dart2wasm-generated main module from `source` which can then
// be instantiated via the `instantiate` method.
//
// `source` needs to be a `Response` object (or promise thereof) e.g. created
// via the `fetch()` JS API.
export async function compileStreaming(source) {
  const builtins = {builtins: ['js-string'], importedStringConstants: ''};
  return new CompiledApp(
      await _compileStreaming(source, builtins), builtins);
}

// Compiles a dart2wasm-generated wasm module from `bytes` which is then
// instantiable via the `instantiate` method.
export async function compile(bytes) {
  const builtins = {builtins: ['js-string'], importedStringConstants: ''};
  return new CompiledApp(await WebAssembly.compile(bytes, builtins), builtins);
}

let _isCompileStreamingSupported;
async function _compileStreaming(source, builtins) {
  _isCompileStreamingSupported ??= WebAssembly.compileStreaming(
    new Response(
      new Uint8Array([0,97,115,109,1,0,0,0,1,4,1,96,0,0,2,23,1,14,119,97,115,109,58,106,115,45,115,116,114,105,110,103,4,99,97,115,116,0,0]),
      {headers: {'Content-Type': 'application/wasm'}},
    ),
    builtins,
  ).then(() => false, (e) => e instanceof WebAssembly.CompileError);
  if (await _isCompileStreamingSupported) {
    return WebAssembly.compileStreaming(source, builtins);
  }
  return WebAssembly.compile(await (await source).arrayBuffer(), builtins);
}

class CompiledApp {
  constructor(module, builtins) {
    this.module = module;
    this.builtins = builtins;
  }

  // The second argument is an options object containing:
  // `loadDeferredModules` is a JS function that takes an array of module names
  //   matching wasm files produced by the dart2wasm compiler. It also takes a
  //   callback that should be invoked for each loaded module with 2 arguments:
  //   (1) the module name, (2) the loaded module in a format supported by
  //   `WebAssembly.compile` or `WebAssembly.compileStreaming`. The callback
  //   returns a Promise that resolves when the module is instantiated.
  //   loadDeferredModules should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  // `loadDeferredId` is a JS function that takes load ID produced by the
  //   compiler when the `use-load-ids` option is passed. Each load ID maps to
  //   one or more wasm files as specified in the emitted JSON file. It also
  //   takes a callback that should be invoked for each loaded module with 2
  //   arguments: (1) the module name, (2) the loaded module in a format
  //   supported by `WebAssembly.compile` or `WebAssembly.compileStreaming`.
  //   The callback returns a Promise that resolves when the module is
  //   instantiated.
  //   loadDeferredId should return a Promise that resolves when all the
  //   modules have been loaded and the callback promises have resolved.
  async instantiate(additionalImports, {loadDeferredModules, loadDeferredId} = {}) {
    let dartInstance;

    // Prints to the console
    function printToConsole(value) {
      if (typeof dartPrint == "function") {
        dartPrint(value);
        return;
      }
      if (typeof console == "object" && typeof console.log != "undefined") {
        console.log(value);
        return;
      }
      if (typeof print == "function") {
        print(value);
        return;
      }

      throw "Unable to print message: " + value;
    }

    // A special symbol attached to functions that wrap Dart functions.
    const jsWrappedDartFunctionSymbol = Symbol("JSWrappedDartFunction");

    function finalizeWrapper(dartFunction, wrapped) {
      wrapped.dartFunction = dartFunction;
      wrapped[jsWrappedDartFunctionSymbol] = true;
      return wrapped;
    }

    // Imports
    const dart2wasm = {
            AB: s => s.trimRight(),
      B: s => printToConsole(s),
      BB: (d, digits) => d.toFixed(digits),
      C: Function.prototype.call.bind(Number.prototype.toString),
      CB: (s) => +s,
      D: Function.prototype.call.bind(BigInt.prototype.toString),
      DB: s => {
        if (!/^\s*[+-]?(?:Infinity|NaN|(?:\.\d+|\d+(?:\.\d*)?)(?:[eE][+-]?\d+)?)\s*$/.test(s)) {
          return NaN;
        }
        return parseFloat(s);
      },
      E: (exn) => {
        let stackString = exn.toString();
        let frames = stackString.split('\n');
        let drop = 4;
        if (frames[0].startsWith('Error')) {
            drop += 1;
        }
        return frames.slice(drop).join('\n');
      },
      EB: (x0,x1) => x0.matchMedia(x1),
      F: () => new Error().stack,
      FB: x0 => x0.matches,
      G: s => JSON.stringify(s),
      GB: () => globalThis.window,
      H: Function.prototype.call.bind(Number.prototype.toString),
      HB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmF32ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      I: Function.prototype.call.bind(String.prototype.indexOf),
      IB: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmF64ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      J: (s, p, i) => s.lastIndexOf(p, i),
      JB: (x0,x1) => x0.test(x1),
      K: (exn) => {
        if (exn instanceof Error) {
          return exn.stack;
        } else {
          return null;
        }
      },
      KB: (handle) => clearTimeout(handle),
      L: o => o === undefined,
      LB: (map, o) => map.get(o),
      M: s => s.trimLeft(),
      MB: () => new WeakMap(),
      N: (x0,x1) => x0.exec(x1),
      NB: (map, o, v) => map.set(o, v),
      O: x0 => x0.length,
      OB: x0 => { globalThis.window.flutterCanvasKit = x0 },
      P: o => o,
      PB: (o,s,v) => o[s] = v,
      Q: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'number') return 1;
        return 2;
      },
      QB: () => Symbol("jsBoxedDartObjectProperty"),
      R: (x0,x1) => { x0.lastIndex = x1 },
      RB: () => ({}),
      S: o => o,
      SB: s => new Date(s * 1000).getTimezoneOffset() * 60,
      T: (s, m) => {
        try {
          return new RegExp(s, m);
        } catch (e) {
          return String(e);
        }
      },
      TB: Date.now,
      U: o => o instanceof RegExp,
      UB: (a, i) => a[i],
      V: (string, times) => string.repeat(times),
      VB: a => a.length,
      W: o => o,
      WB: o => o instanceof Array,
      X: o => {
        if (o === undefined || o === null) return 0;
        if (typeof o === 'boolean') return 1;
        return 2;
      },
      XB: (a, s, e) => a.slice(s, e),
      Y: x0 => x0.dotAll,
      YB: (a, i, v) => a[i] = v,
      Z: x0 => x0.unicode,
      ZB: (a, i) => a.splice(i, 1),
      a: x0 => x0.ignoreCase,
      aB: a => a.pop(),
      b: x0 => x0.multiline,
      bB: (l, r) => l === r,
      c: (string, token) => string.split(token),
      d: x0 => x0.random(),
      e: () => globalThis.Math,
      f: (decoder, codeUnits) => decoder.decode(codeUnits),
      g: (o, start, length) => new Uint8Array(o.buffer, o.byteOffset + start, length),
      h: () => new TextDecoder("utf-8", {fatal: true}),
      i: () => new TextDecoder("utf-8", {fatal: false}),
      j: s => s.toUpperCase(),
      k: Object.is,
      l: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmI8ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      m: (jsArray, jsArrayOffset, wasmArray, wasmArrayOffset, length) => {
        const setValue = dartInstance.exports.$wasmI32ArraySet;
        for (let i = 0; i < length; i++) {
          setValue(wasmArray, wasmArrayOffset + i, jsArray[jsArrayOffset + i]);
        }
      },
      n: Function.prototype.call.bind(String.prototype.toLowerCase),
      o: (o, p, r) => o.replaceAll(p, () => r),
      p: o => String(o),
      q: (x0,x1) => x0[x1],
      r: x0 => x0.index,
      s: x0 => x0.flags,
      t: s => s.trim(),
      u: (c) =>
      queueMicrotask(() => dartInstance.exports.$invokeCallback(c)),
      v: () => Date.now(),
      w: (ms, c) =>
      setTimeout(() => dartInstance.exports.$invokeCallback(c),ms),
      x: () => typeof dartUseDateNowForTicks !== "undefined",
      y: () => 1000 * performance.now(),
      z: x0 => x0.pop(),

    };

    const baseImports = {
      _: dart2wasm,
      Math: Math,
      Date: Date,
      Object: Object,
      Array: Array,
      Reflect: Reflect,
      WebAssembly: {
        JSTag: WebAssembly.JSTag,
      },
      "": new Proxy({}, { get(_, prop) { return prop; } }),

    };

    

    dartInstance = await WebAssembly.instantiate(this.module, {
      ...baseImports,
      ...additionalImports,
      
    });

    return new InstantiatedApp(this, dartInstance);
  }
}

class InstantiatedApp {
  constructor(compiledApp, instantiatedModule) {
    this.compiledApp = compiledApp;
    this.instantiatedModule = instantiatedModule;
  }

  // Call the main function with the given arguments.
  invokeMain(...args) {
    this.instantiatedModule.exports.$invokeMain(args);
  }
}
