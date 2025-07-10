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

// Disable explicit GC (it wouldn't work in browsers anyway).
globalThis.gc = () => {
  // DEBUG
  // console.log("gc()");
}

class URL {
  href;
  constructor(url, base) {
    // DEBUG
    // console.log('URL', url, base);
    this.href = url;
  }
}
globalThis.URL = URL;

// We always polyfill `fetch` and `instantiateStreaming` for consistency between
// engine shells and browsers and to avoid introducing network latency into the
// first iteration / instantiation measurement.
// The downside is that this doesn't test streaming Wasm instantiation, which we
// are willing to accept.
let preload = {};
globalThis.fetch = async function(url) {
  // DEBUG
  // console.log('fetch', url);
  if (!preload[url]) {
    throw new Error('Unexpected fetch: ' + url);
  }
  return {
    ok: true,
    status: 200,
    arrayBuffer() { return preload[url]; },
    async blob() {
      return {
        size: preload[url].byteLength,
        async arrayBuffer() { return preload[url]; }
      }
    },
  };
};
globalThis.WebAssembly.instantiateStreaming = async function(m,i) {
  // DEBUG
  // console.log('instantiateStreaming',m,i);
  return WebAssembly.instantiate((await m).arrayBuffer(),i);
};

// Provide `setTimeout` for Kotlin coroutines.
// Deep in the Compose UI framework, one task is scheduled every 16ms, see
// https://github.com/JetBrains/compose-multiplatform-core/blob/a52f2981b9bc7cdba1d1fbe71654c4be448ebea7/compose/ui/ui/src/commonMain/kotlin/androidx/compose/ui/spatial/RectManager.kt#L138
// and
// https://github.com/JetBrains/compose-multiplatform-core/blob/a52f2981b9bc7cdba1d1fbe71654c4be448ebea7/compose/ui/ui/src/commonMain/kotlin/androidx/compose/ui/layout/OnLayoutRectChangedModifier.kt#L56
// We don't want to delay work in the Wall-time based measurement in JetStream,
// but executing this immediately (without delay) produces redundant work that 
// is not realistic for a full-browser Kotlin/multiplatform application either,
// according to Kotlin/JetBrains folks.
// Hence the early return for 16ms delays below.
// FIXME: The SpiderMonkey shell doesn't have `setTimeout` (yet). We could also
// polyfill this with `Promise.resolve().then(f)`, but that changes the CPU
// profile slightly on other engines, so it's probably best to just add support.
const originalSetTimeout = setTimeout;
globalThis.setTimeout = function(f, delayMs) {
  // DEBUG
  // console.log('setTimeout', f, t);

  if (delayMs === 16) return;
  if (delayMs !== 0) {
    throw new Error('Unexpected delay for setTimeout polyfill: ' + delayMs);
  }
  originalSetTimeout(f);
  
  // Alternative, if setTimeout is not available in a shell (but that changes
  // the performance profile a little bit, so I'd rather not do that):
  // Promise.resolve().then(f);

  // Yet another alternative is to run the task synchronously, but that obviously
  // overflows the stack at some point if the callback itself spawns more work:
  // f();
}

// Don't automatically run the main function on instantiation.
globalThis.skipFunMain = true;

// Prevent this from being detected as a shell environment, so that we use the
// same code paths as in the browser.
// See `compose-benchmarks-benchmarks.uninstantiated.mjs`.
delete globalThis.d8;
delete globalThis.inIon;
delete globalThis.jscOptions;

// The JetStream driver doesn't have support for ES6 modules yet.
// Since this file is not an ES module, we have to use a dynamic import.
// However, browsers and different shalls have different requirements on whether
// the path can or may be relative, so try all possible combinations.
// TODO: Support ES6 modules in the driver instead of this one-off solution.
// This probably requires a new `Benchmark` field called `modules` that
// is a map from module variable name (which will hold the resulting module
// namespace object) to relative module URL, which is resolved in the
// `preRunnerCode`, similar to this code here.
async function dynamicJSImport(path) {
  let result;
  if (isInBrowser) {
    // In browsers, relative imports don't work since we are not in a module.
    // (`import.meta.url` is not defined.)
    const pathname = location.pathname.match(/^(.*\/)(?:[^.]+(?:\.(?:[^\/]+))+)?$/)[1];
    result = await import(location.origin + pathname + './' + path);
  } else {
    // In shells, relative imports require different paths, so try with and
    // without the "./" prefix (e.g., JSC requires it).
    try {
      result = await import(path);
    } catch {
      result = await import('./' + path);
    }
  }
  return result;
}

class Benchmark {
  skikoInstantiate;
  mainInstantiate;
  wasmInstanceExports;

  async init() {
    // DEBUG
    // console.log("init");

    preload = {
      'skiko.wasm': Module.wasmSkikoBinary,
      './compose-benchmarks-benchmarks.wasm': Module.wasmBinary,
      './composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/compose-multiplatform.png': Module.inputImageCompose,
      './composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/example1_cat.jpg': Module.inputImageCat,
      './composeResources/compose_benchmarks.benchmarks.generated.resources/files/example1_compose-community-primary.png': Module.inputImageComposeCommunity,
      './composeResources/compose_benchmarks.benchmarks.generated.resources/font/jetbrainsmono_italic.ttf': Module.inputFontItalic,
      './composeResources/compose_benchmarks.benchmarks.generated.resources/font/jetbrainsmono_regular.ttf': Module.inputFontRegular,
    };

    // We patched `skiko.mjs` to not immediately instantiate the `skiko.wasm`
    // module, so that we can move the dynamic JS import here but measure 
    // WebAssembly compilation and instantiation as part of the first iteration.
    this.skikoInstantiate = (await dynamicJSImport('Kotlin-compose/build/skiko.mjs')).default;
    this.mainInstantiate = (await dynamicJSImport('Kotlin-compose/build/compose-benchmarks-benchmarks.uninstantiated.mjs')).instantiate;
  }

  async runIteration() {
    // DEBUG
    // console.log("runIteration");

    // Compile once in the first iteration.
    if (!this.wasmInstanceExports) {
      const skikoExports = (await this.skikoInstantiate()).wasmExports;
      this.wasmInstanceExports = (await this.mainInstantiate({ './skiko.mjs': skikoExports })).exports;
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
