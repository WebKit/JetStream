// Copyright 2025 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// Excerpt from `polyfills.mjs` from the upstream Kotlin compose-multiplatform
// benchmark directory, with minor changes for JetStream.

globalThis.window ??= globalThis;

globalThis.navigator ??= {};
if (!globalThis.navigator.languages) {
  globalThis.navigator.languages = ['en-US', 'en'];
  globalThis.navigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  globalThis.navigator.platform = "MacIntel";
}

// Compose reads `window.isSecureContext` in its Clipboard feature:
globalThis.isSecureContext = false;

// Disable the browser CacheStorage API (`window.caches`) so Compose 1.12+'s
// `ResourceWebCache` reads preloaded resources directly from the in-memory
// `fetch` polyfill below in browsers just as it does in JS shells.
Object.defineProperty(globalThis, 'caches', { value: undefined, configurable: true });

// Disable explicit GC (it wouldn't work in browsers anyway).
globalThis.gc = () => {
  // DEBUG
  // console.log("gc()");
}

if (typeof globalThis.AbortController === 'undefined') {
  globalThis.AbortController = class {
    constructor() {
      this.signal = {};
    }
    abort() {}
  };
}

class BlobPolyfill {
  constructor(uint8, type = '') {
    this._uint8 = uint8;
    this._type = type;
  }
  get size() {
    return this._uint8.byteLength;
  }
  get type() {
    return this._type;
  }
  async arrayBuffer() {
    return this._uint8.buffer;
  }
  slice(start = 0, end = this.size, type = this.type) {
    return new BlobPolyfill(this._uint8.slice(start, end), type);
  }
}

// Compose Multiplatform's `DefaultWebResourceReader` loads embedded UI assets
// (PNG/JPG images and TTF fonts) via:
//   `fetch('./composeResources/compose_benchmarks.benchmarks.generated.resources/<dir>/<filename>')`
// followed by `.blob()`.
// We always override `fetch` to serve these assets from `preloadResources`
// (populated in `init()` below, keyed by `<filename>`) for consistency between
// engine shells and browsers and to avoid network requests during iterations.
let preloadResources = { /* Initialized in init() below due to async. */ };
const originalFetch = globalThis.fetch ?? function(url) {
  throw new Error("no fetch available");
}
globalThis.fetch = async function(url) {
  // DEBUG
  // console.log('fetch', url);

  const filename = url.split('/').pop();
  if (preloadResources[filename]) {
    const buf = preloadResources[filename];
    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      async blob() {
        return new BlobPolyfill(new Uint8Array(buf));
      },
    };
  }

  // This should only be called in the browser, where fetch() is available.
  return originalFetch(url);
};

// Provide `setTimeout` for Kotlin coroutines.
const originalSetTimeout = setTimeout;
globalThis.setTimeout = function(f, delayMs) {
  // DEBUG
  // console.log('setTimeout', f, t);

  // Deep in the Compose UI framework, one task is scheduled every 16ms, see
  // https://github.com/JetBrains/compose-multiplatform-core/blob/a52f2981b9bc7cdba1d1fbe71654c4be448ebea7/compose/ui/ui/src/commonMain/kotlin/androidx/compose/ui/spatial/RectManager.kt#L138
  // and
  // https://github.com/JetBrains/compose-multiplatform-core/blob/a52f2981b9bc7cdba1d1fbe71654c4be448ebea7/compose/ui/ui/src/commonMain/kotlin/androidx/compose/ui/layout/OnLayoutRectChangedModifier.kt#L56
  // We don't want to delay work in the Wall-time based measurement in JetStream,
  // but executing this immediately (without delay) produces redundant work that 
  // is not realistic for a full-browser Kotlin/multiplatform application either,
  // according to Kotlin/JetBrains folks.
  // Hence the early return for 16ms delays.
  if (delayMs === 16) return;
  if (delayMs !== 0) {
    throw new Error('Unexpected delay for setTimeout polyfill: ' + delayMs);
  }
  originalSetTimeout(f);
}

// Compose 1.13 registers a `window.addEventListener('languagechange', ...)`
// listener on scene initialization, and `kotlinx.coroutines` checks
// `typeof window.addEventListener === 'function'` (`tryGetWindow`) to select
// its browser `WindowMessageQueue` (`window.postMessage`) dispatcher.
if (typeof globalThis.addEventListener === 'undefined') {
  const messageListeners = [];
  globalThis.addEventListener = function(type, listener) {
    if (type === 'message') {
      messageListeners.push(listener);
    }
  };
  globalThis.postMessage = function(data) {
    originalSetTimeout(() => {
      const event = { source: globalThis, data, stopPropagation() {} };
      for (const listener of messageListeners) {
        listener(event);
      }
    });
  };
}

// Suppress Kotlin's console output unless WasmEMCCBenchmark's verbose mode is
// enabled, so benchmark iterations don't spam stdout/stderr.
if (typeof verbose === 'undefined' || !verbose) {
  globalThis.console.log = () => {};
  globalThis.console.warn = () => {};
}

class Benchmark {
  skikoModule;
  skikoWasmBytes;
  composeImportObjectModule;
  composeWasmBytes;
  wasmInstanceExports;

  async init() {
    // DEBUG
    // console.log("init");

    this.skikoWasmBytes = await JetStream.getBinary(JetStream.preload.skikoWasmBinary);
    this.composeWasmBytes = await JetStream.getBinary(JetStream.preload.composeWasmBinary);

    // Preload all non-code Compose UI assets (images and fonts) from
    // `JetStream.resources` (which maps `./workloads/Kotlin-compose-wasm/build/<filename>`
    // to its preloaded URL), keyed by `<filename>` so the `fetch()` override
    // above can match requests for `./composeResources/.../<dir>/<filename>`.
    preloadResources = {};
    for (const [path, url] of Object.entries(JetStream.resources)) {
      if (!path.endsWith('.mjs') && !path.endsWith('.wasm')) {
        const filename = path.split('/').pop();
        preloadResources[filename] = await JetStream.getBinary(url);
      }
    }

    // We patched `skiko.mjs` to not immediately instantiate the `skiko.wasm`
    // module, so that we can move the dynamic JS import here but measure 
    // WebAssembly compilation and instantiation as part of the first iteration.
    this.skikoModule = await JetStream.dynamicImport(JetStream.preload.skikoJsModule);
    globalThis.kotlinWasmImports = { './skiko.mjs': this.skikoModule };
    this.composeImportObjectModule = await JetStream.dynamicImport(JetStream.preload.composeJsModule);
  }

  async runIteration() {
    // DEBUG
    // console.log("runIteration");

    // Compile once in the first iteration.
    if (!this.wasmInstanceExports) {
      // Pass Emscripten's `instantiateWasm` hook so `skiko.mjs` instantiates
      // the preloaded `skiko.wasm` bytes directly without calling `fetch()`.
      const { wasmExports: skikoWasmExports } = await this.skikoModule.default({
        instantiateWasm: (imports, successCallback) => {
          WebAssembly.instantiate(this.skikoWasmBytes, imports).then(
            ({ instance, module }) => successCallback(instance, module)
          );
          return {};
        },
      });

      const { importObject, setWasmExports } = this.composeImportObjectModule;
      // Replace `skiko.mjs`'s lazy JS wrapper thunks with the direct Wasm
      // exports from `skiko.wasm`, matching JetStream 3.0.
      importObject['./skiko.mjs'] = skikoWasmExports;

      const wasmOptions = { builtins: ['js-string'], importedStringConstants: "'" };
      const { instance } = await WebAssembly.instantiate(
        this.composeWasmBytes,
        importObject,
        wasmOptions
      );
      setWasmExports(Object.assign({ memory: importObject.intrinsics.memory }, instance.exports));
      instance.exports._start();
      this.wasmInstanceExports = instance.exports;
    }

    // We render/animate/process fewer frames than in the upstream benchmark,
    // since we run multiple iterations in JetStream (to measure first, worst,
    // and average runtime) and don't want the overall workload to take too long.
    const frameCountFactor = 5;
    
    // The factors for the subitems are chosen to make them take the same order
    // of magnitude in terms of Wall time.
    await this.wasmInstanceExports.customLaunch("AnimatedVisibility", 100 * frameCountFactor);
    await this.wasmInstanceExports.customLaunch("LazyGrid", 1 * frameCountFactor);
    await this.wasmInstanceExports.customLaunch("LazyGrid-ItemLaunchedEffect", 1 * frameCountFactor);
    // The `SmoothScroll` variants of the LazyGrid workload are much faster.
    await this.wasmInstanceExports.customLaunch("LazyGrid-SmoothScroll", 5 * frameCountFactor);
    await this.wasmInstanceExports.customLaunch("LazyGrid-SmoothScroll-ItemLaunchedEffect", 5 * frameCountFactor);
    // This is quite GC-heavy, is this realistic for Kotlin/compose applications?
    await this.wasmInstanceExports.customLaunch("VisualEffects", 1 * frameCountFactor);
    await this.wasmInstanceExports.customLaunch("MultipleComponents-NoVectorGraphics", 10 * frameCountFactor);
  }
}
