const Li9za2lrby5tanM = globalThis.kotlinWasmImports?.['./skiko.mjs'] ?? {};
const QGpzLWpvZGEvY29yZQ = globalThis.kotlinWasmImports?.['@js-joda/core'] ?? {};
const d2FzbTpqcy1zdHJpbmc = globalThis.kotlinWasmImports?.['./compose-benchmarks-benchmarks.js-builtins.mjs'] ?? {};

const wasmJsTag = WebAssembly.JSTag;
const wasmTag = wasmJsTag ?? new WebAssembly.Tag({ parameters: ['externref'] });

// Placed here to give access to it from externals (js_code)
let wasmExports;

if (typeof process !== 'undefined' && process.release.name === 'node') {
    function doNotUseRequire() {
        throw new Error("Do not use top-level require. Prefer to use JS import or define your own require instead. Read more: https://kotl.in/r9txlt")
    }

    var require = new Proxy((function() {}), {
        apply(target, thisArg, argumentsList) {
            if (globalThis.require != null) {
                return globalThis.require.apply(thisArg, argumentsList);
            } else {
                doNotUseRequire();
            }
        },
        get(target, prop, receiver) {
            if (globalThis.require != null) {
                return Reflect.get(globalThis.require, prop);
            } else {
                doNotUseRequire();
            }
        },
    });
}

export function setWasmExports(exports) {
    wasmExports = exports;
}

const _ref_Li9za2lrby5tanM_ = Li9za2lrby5tanM;
const _ref_Li9za2lrby5tanM_c2tpa29BcGk = Li9za2lrby5tanM.skikoApi;
const _ref_QGpzLWpvZGEvY29yZQ_ = QGpzLWpvZGEvY29yZQ;

const cachedJsObjects = new WeakMap();
function getCachedJsObject(ref, ifNotCached) {
    if (typeof ref !== 'object' && typeof ref !== 'function') return ifNotCached;
    const cached = cachedJsObjects.get(ref);
    if (cached !== void 0) return cached;
    cachedJsObjects.set(ref, ifNotCached);
    return ifNotCached;
}

const js_code = {
    'kotlin.createJsError' : (message, cause) => new Error(message, { cause }),
    'kotlin.wasm.internal.jsThrow' : wasmTag === wasmJsTag ? (e) => { throw e; } : () => {},
    'kotlin.wasm.internal.getJsEmptyString' : () => '',
    'kotlin.wasm.internal.externrefToInt' : (ref) => Number(ref),
    'kotlin.wasm.internal.intToExternref' : (x) => x,
    'kotlin.wasm.internal.externrefToDouble' : (ref) => Number(ref),
    'kotlin.wasm.internal.externrefToString' : (ref) => String(ref),
    'kotlin.wasm.internal.externrefEquals' : (lhs, rhs) => lhs === rhs,
    'kotlin.wasm.internal.externrefHashCode' : 
    (() => {
    const dataView = new DataView(new ArrayBuffer(8));
    function numberHashCode(obj) {
        if ((obj | 0) === obj) {
            return obj | 0;
        } else {
            dataView.setFloat64(0, obj, true);
            return (dataView.getInt32(0, true) * 31 | 0) + dataView.getInt32(4, true) | 0;
        }
    }

    const hashCodes = new WeakMap();
    function getObjectHashCode(obj) {
        const res = hashCodes.get(obj);
        if (res === undefined) {
            const POW_2_32 = 4294967296;
            const hash = (Math.random() * POW_2_32) | 0;
            hashCodes.set(obj, hash);
            return hash;
        }
        return res;
    }

    function getStringHashCode(str) {
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            var code  = str.charCodeAt(i);
            hash  = (hash * 31 + code) | 0;
        }
        return hash;
    }

    return (obj) => {
        if (obj == null) {
            return 0;
        }
        switch (typeof obj) {
            case "object":
            case "function":
                return getObjectHashCode(obj);
            case "number":
                return numberHashCode(obj);
            case "boolean":
                return obj ? 1231 : 1237;
            default:
                return getStringHashCode(String(obj)); 
        }
    }
    })(),
    'kotlin.wasm.internal.isNullish' : (ref) => ref == null,
    'kotlin.wasm.internal.getJsTrue' : () => true,
    'kotlin.wasm.internal.getJsFalse' : () => false,
    'kotlin.wasm.internal.kotlinUIntToJsNumberUnsafe' : (x) => x >>> 0,
    'kotlin.wasm.internal.kotlinULongToJsBigIntUnsafe' : (x) => x & 0xFFFFFFFFFFFFFFFFn,
    'kotlin.wasm.internal.newJsArray' : () => [],
    'kotlin.wasm.internal.jsArrayPush' : (array, element) => { array.push(element); },
    'kotlin.wasm.internal.getCachedJsObject_$external_fun' : (p0, p1) => getCachedJsObject(p0, p1),
    'kotlin.wasm.internal.utoa32_$external_fun' : (p0) => String(p0),
    'kotlin.wasm.internal.utoa64_$external_fun' : (p0) => String(p0),
    'kotlin.wasm.internal.itoa32_$external_fun' : (p0) => String(p0),
    'kotlin.wasm.internal.itoa64_$external_fun' : (p0) => String(p0),
    'kotlin.js.jsCatch' : (f) => { 
        let result = null;
        try { 
            f();
        } catch (e) {
           result = e;
        }
        return result;
         },
    'kotlin.js.__convertKotlinClosureToJsClosure_0' : (f, trampoline) => getCachedJsObject(f, () => trampoline(f, )),
    'kotlin.js.jsThrow' : (e) => { throw e; },
    'kotlin.io.printlnImpl' : (message) => console.log(message),
    'kotlin.js.jsArrayGet' : (array, index) => array[index],
    'kotlin.js.jsArraySet' : (array, index, value) => { array[index] = value },
    'kotlin.js.JsArray_$external_fun' : () => new Array(),
    'kotlin.js.length_$external_prop_getter' : (_this) => _this.length,
    'kotlin.js.stackPlaceHolder_js_code' : () => (''),
    'kotlin.js.message_$external_prop_getter' : (_this) => _this.message,
    'kotlin.js.name_$external_prop_setter' : (_this, v) => _this.name = v,
    'kotlin.js.stack_$external_prop_getter' : (_this) => _this.stack,
    'kotlin.js.kotlinException_$external_prop_getter' : (_this) => _this.kotlinException,
    'kotlin.js.kotlinException_$external_prop_setter' : (_this, v) => _this.kotlinException = v,
    'kotlin.js.JsError_$external_class_instanceof' : (x) => x instanceof Error,
    'kotlin.js.JsString_$external_class_instanceof' : (x) => typeof x === 'string',
    'kotlin.js.JsString_$external_class_get' : () => JsString,
    'kotlin.js.Promise_$external_fun' : (p0) => new Promise(p0),
    'kotlin.js.__callJsClosure_((Js?)->Unit)' : (f, p0) => f(p0),
    'kotlin.js.__callJsClosure_((Js)->Unit)' : (f, p0) => f(p0),
    'kotlin.js.__convertKotlinClosureToJsClosure_2' : (f, trampoline) => getCachedJsObject(f, (p0, p1) => trampoline(f, p0, p1)),
    'kotlin.js.then_$external_fun' : (_this, p0) => _this.then(p0),
    'kotlin.js.__convertKotlinClosureToJsClosure_1' : (f, trampoline) => getCachedJsObject(f, (p0) => trampoline(f, p0)),
    'kotlin.js.then_$external_fun_1' : (_this, p0, p1) => _this.then(p0, p1),
    'kotlin.js.catch_$external_fun' : (_this, p0) => _this.catch(p0),
    'kotlin.js.Promise_$external_class_instanceof' : (x) => x instanceof Promise,
    'kotlin.js.Promise_$external_class_get' : () => Promise,
    'kotlin.random.initialSeed' : () => ((Math.random() * Math.pow(2, 32)) | 0),
    'kotlin.wasm.internal.getJsClassName' : (jsKlass) => jsKlass.name,
    'kotlin.wasm.internal.instanceOf' : (ref, jsKlass) => ref instanceof jsKlass,
    'kotlin.wasm.internal.getConstructor' : (obj) => obj.constructor,
    'kotlin.time.tryGetPerformance' : () => typeof globalThis !== 'undefined' && typeof globalThis.performance !== 'undefined' ? globalThis.performance : null,
    'kotlin.time.getPerformanceNow' : (performance) => performance.now(),
    'kotlin.time.dateNow' : () => Date.now(),
    'kotlinx.coroutines.tryGetProcess' : () => (typeof(process) !== 'undefined' && typeof(process.nextTick) === 'function') ? process : null,
    'kotlinx.coroutines.tryGetWindow' : () => (typeof(window) !== 'undefined' && window != null && typeof(window.addEventListener) === 'function') ? window : null,
    'kotlinx.coroutines.nextTick_$external_fun' : (_this, p0) => _this.nextTick(p0),
    'kotlinx.coroutines.createScheduleMessagePoster' : (process) => () => Promise.resolve(0).then(process),
    'kotlinx.coroutines.__callJsClosure_(()->Unit)' : (f, ) => f(),
    'kotlinx.coroutines.createRescheduleMessagePoster' : (window) => () => window.postMessage('dispatchCoroutine', '*'),
    'kotlinx.coroutines.subscribeToWindowMessages' : (window, process) => {
        const handler = (event) => {
            if (event.source == window && event.data == 'dispatchCoroutine') {
                event.stopPropagation();
                process();
            }
        }
        window.addEventListener('message', handler, true);
    },
    'kotlinx.coroutines.setTimeout' : (window, handler, timeout) => window.setTimeout(handler, timeout),
    'kotlinx.coroutines.clearTimeout' : (handle) => { if (typeof clearTimeout !== 'undefined') clearTimeout(handle); },
    'kotlinx.coroutines.clearTimeout_$external_fun' : (_this, p0) => _this.clearTimeout(p0),
    'kotlinx.coroutines.setTimeout_$external_fun' : (p0, p1) => setTimeout(p0, p1),
    'kotlinx.coroutines.promiseSetDeferred' : (promise, deferred) => promise.deferred = deferred,
    'kotlinx.coroutines.internal.throwAsyncJsError' : (message, className, stack) => { 
            var error = new Error();
            error.message = message;
            error.name = className;
            error.stack = stack;
            if (typeof globalThis.reportError === 'function') {
                // Up-to-date browsers and some non-browser JS runtimes (Deno, Bun)
                globalThis.reportError(error);
            } else {
                // Fallback for old browsers (pre-2022), Node.js
                setTimeout(function () { throw error }, 0);
            }
         },
    'org.khronos.webgl.getMethodImplForUint8Array' : (obj, index) => obj[index],
    'org.khronos.webgl.byteLength_$external_prop_getter' : (_this) => _this.byteLength,
    'org.khronos.webgl.slice_$external_fun' : (_this, p0, p1, isDefault0) => _this.slice(p0, isDefault0 ? undefined : p1, ),
    'org.khronos.webgl.Uint8Array_$external_fun' : (p0, p1, p2, isDefault0, isDefault1) => new Uint8Array(p0, isDefault0 ? undefined : p1, isDefault1 ? undefined : p2, ),
    'org.khronos.webgl.length_$external_prop_getter' : (_this) => _this.length,
    'org.khronos.webgl.buffer_$external_prop_getter' : (_this) => _this.buffer,
    'org.khronos.webgl.byteOffset_$external_prop_getter' : (_this) => _this.byteOffset,
    'org.khronos.webgl.byteLength_$external_prop_getter_1' : (_this) => _this.byteLength,
    'org.w3c.dom.clipboard.clipboardData_$external_prop_getter' : (_this) => _this.clipboardData,
    'org.w3c.dom.clipboard.ClipboardEvent_$external_class_instanceof' : (x) => x instanceof ClipboardEvent,
    'org.w3c.dom.css.display_$external_prop_setter' : (_this, v) => _this.display = v,
    'org.w3c.dom.css.fontSize_$external_prop_getter' : (_this) => _this.fontSize,
    'org.w3c.dom.css.fontSize_$external_prop_setter' : (_this, v) => _this.fontSize = v,
    'org.w3c.dom.css.style_$external_prop_getter' : (_this) => _this.style,
    'org.w3c.dom.events.type_$external_prop_getter' : (_this) => _this.type,
    'org.w3c.dom.events.timeStamp_$external_prop_getter' : (_this) => _this.timeStamp,
    'org.w3c.dom.events.preventDefault_$external_fun' : (_this, ) => _this.preventDefault(),
    'org.w3c.dom.events.Event_$external_class_instanceof' : (x) => x instanceof Event,
    'org.w3c.dom.events.key_$external_prop_getter' : (_this) => _this.key,
    'org.w3c.dom.events.KeyboardEvent_$external_class_instanceof' : (x) => x instanceof KeyboardEvent,
    'org.w3c.dom.events.deltaX_$external_prop_getter' : (_this) => _this.deltaX,
    'org.w3c.dom.events.deltaY_$external_prop_getter' : (_this) => _this.deltaY,
    'org.w3c.dom.events.deltaMode_$external_prop_getter' : (_this) => _this.deltaMode,
    'org.w3c.dom.events.DOM_DELTA_PIXEL_$external_prop_getter' : (_this) => _this.DOM_DELTA_PIXEL,
    'org.w3c.dom.events.DOM_DELTA_LINE_$external_prop_getter' : (_this) => _this.DOM_DELTA_LINE,
    'org.w3c.dom.events.DOM_DELTA_PAGE_$external_prop_getter' : (_this) => _this.DOM_DELTA_PAGE,
    'org.w3c.dom.events.Companion_$external_object_getInstance' : () => WheelEvent,
    'org.w3c.dom.events.WheelEvent_$external_class_instanceof' : (x) => x instanceof WheelEvent,
    'org.w3c.dom.events.addEventListener_$external_fun' : (_this, p0, p1, p2) => _this.addEventListener(p0, p1, p2),
    'org.w3c.dom.events.addEventListener_$external_fun_1' : (_this, p0, p1) => _this.addEventListener(p0, p1),
    'org.w3c.dom.events.addEventListener_$external_fun_2' : (_this, p0, p1) => _this.addEventListener(p0, p1),
    'org.w3c.dom.events.removeEventListener_$external_fun' : (_this, p0, p1) => _this.removeEventListener(p0, p1),
    'org.w3c.dom.events.removeEventListener_$external_fun_1' : (_this, p0, p1) => _this.removeEventListener(p0, p1),
    'org.w3c.dom.AddEventListenerOptions_js_code' : (passive, once, capture) => ({ passive: passive, once: once, capture: capture }),
    'org.w3c.dom.location_$external_prop_getter' : (_this) => _this.location,
    'org.w3c.dom.navigator_$external_prop_getter' : (_this) => _this.navigator,
    'org.w3c.dom.devicePixelRatio_$external_prop_getter' : (_this) => _this.devicePixelRatio,
    'org.w3c.dom.open_$external_fun' : (_this, p0, p1, p2, isDefault0, isDefault1, isDefault2) => _this.open(isDefault0 ? undefined : p0, isDefault1 ? undefined : p1, isDefault2 ? undefined : p2, ),
    'org.w3c.dom.matchMedia_$external_fun' : (_this, p0) => _this.matchMedia(p0),
    'org.w3c.dom.getComputedStyle_$external_fun' : (_this, p0, p1, isDefault0) => _this.getComputedStyle(p0, isDefault0 ? undefined : p1, ),
    'org.w3c.dom.matches_$external_prop_getter' : (_this) => _this.matches,
    'org.w3c.dom.MediaQueryList_$external_class_instanceof' : (x) => x instanceof MediaQueryList,
    'org.w3c.dom.MediaQueryList_$external_class_get' : () => MediaQueryList,
    'org.w3c.dom.protocol_$external_prop_getter' : (_this) => _this.protocol,
    'org.w3c.dom.hostname_$external_prop_getter' : (_this) => _this.hostname,
    'org.w3c.dom.HTMLElement_$external_class_instanceof' : (x) => x instanceof HTMLElement,
    'org.w3c.dom.HTMLElement_$external_class_get' : () => HTMLElement,
    'org.w3c.dom.documentElement_$external_prop_getter' : (_this) => _this.documentElement,
    'org.w3c.dom.body_$external_prop_getter' : (_this) => _this.body,
    'org.w3c.dom.createElement_$external_fun' : (_this, p0, p1, isDefault0) => _this.createElement(p0, isDefault0 ? undefined : p1, ),
    'org.w3c.dom.namespaceURI_$external_prop_getter' : (_this) => _this.namespaceURI,
    'org.w3c.dom.localName_$external_prop_getter' : (_this) => _this.localName,
    'org.w3c.dom.getAttribute_$external_fun' : (_this, p0) => _this.getAttribute(p0),
    'org.w3c.dom.getAttributeNS_$external_fun' : (_this, p0, p1) => _this.getAttributeNS(p0, p1),
    'org.w3c.dom.Element_$external_class_instanceof' : (x) => x instanceof Element,
    'org.w3c.dom.nodeName_$external_prop_getter' : (_this) => _this.nodeName,
    'org.w3c.dom.childNodes_$external_prop_getter' : (_this) => _this.childNodes,
    'org.w3c.dom.lookupPrefix_$external_fun' : (_this, p0) => _this.lookupPrefix(p0),
    'org.w3c.dom.appendChild_$external_fun' : (_this, p0) => _this.appendChild(p0),
    'org.w3c.dom.removeChild_$external_fun' : (_this, p0) => _this.removeChild(p0),
    'org.w3c.dom.getData_$external_fun' : (_this, p0) => _this.getData(p0),
    'org.w3c.dom.setData_$external_fun' : (_this, p0, p1) => _this.setData(p0, p1),
    'org.w3c.dom.readyState_$external_prop_getter' : (_this) => _this.readyState,
    'org.w3c.dom.protocol_$external_prop_getter_1' : (_this) => _this.protocol,
    'org.w3c.dom.binaryType_$external_prop_setter' : (_this, v) => _this.binaryType = v,
    'org.w3c.dom.close_$external_fun' : (_this, p0, p1, isDefault0, isDefault1) => _this.close(isDefault0 ? undefined : p0, isDefault1 ? undefined : p1, ),
    'org.w3c.dom.send_$external_fun' : (_this, p0) => _this.send(p0),
    'org.w3c.dom.send_$external_fun_1' : (_this, p0) => _this.send(p0),
    'org.w3c.dom.OPEN_$external_prop_getter' : (_this) => _this.OPEN,
    'org.w3c.dom.Companion_$external_object_getInstance' : () => WebSocket,
    'org.w3c.dom.data_$external_prop_getter' : (_this) => _this.data,
    'org.w3c.dom.code_$external_prop_getter' : (_this) => _this.code,
    'org.w3c.dom.reason_$external_prop_getter' : (_this) => _this.reason,
    'org.w3c.dom.Companion_$external_object_getInstance_1' : () => ({}),
    'org.w3c.dom.userAgent_$external_prop_getter' : (_this) => _this.userAgent,
    'org.w3c.dom.language_$external_prop_getter' : (_this) => _this.language,
    'org.w3c.dom.caches_$external_prop_getter' : (_this) => _this.caches,
    'org.w3c.dom.item_$external_fun' : (_this, p0) => _this.item(p0),
    'org.w3c.dom.parsing.DOMParser_$external_fun' : () => new DOMParser(),
    'org.w3c.dom.parsing.parseFromString_$external_fun' : (_this, p0, p1) => _this.parseFromString(p0, p1),
    'org.w3c.fetch.status_$external_prop_getter' : (_this) => _this.status,
    'org.w3c.fetch.ok_$external_prop_getter' : (_this) => _this.ok,
    'org.w3c.fetch.statusText_$external_prop_getter' : (_this) => _this.statusText,
    'org.w3c.fetch.headers_$external_prop_getter' : (_this) => _this.headers,
    'org.w3c.fetch.body_$external_prop_getter' : (_this) => _this.body,
    'org.w3c.fetch.clone_$external_fun' : (_this, ) => _this.clone(),
    'org.w3c.fetch.blob_$external_fun' : (_this, ) => _this.blob(),
    'org.w3c.fetch.get_$external_fun' : (_this, p0) => _this.get(p0),
    'org.w3c.fetch.Companion_$external_object_getInstance' : () => ({}),
    'org.w3c.performance.now_$external_fun' : (_this, ) => _this.now(),
    'org.w3c.performance.performance_$external_prop_getter' : (_this) => _this.performance,
    'org.w3c.workers.CacheQueryOptions_js_code' : (ignoreSearch, ignoreMethod, ignoreVary, cacheName) => ({ ignoreSearch: ignoreSearch, ignoreMethod: ignoreMethod, ignoreVary: ignoreVary, cacheName: cacheName }),
    'org.w3c.workers.match_$external_fun' : (_this, p0, p1, isDefault0) => _this.match(p0, isDefault0 ? undefined : p1, ),
    'org.w3c.workers.put_$external_fun' : (_this, p0, p1) => _this.put(p0, p1),
    'org.w3c.workers.open_$external_fun' : (_this, p0) => _this.open(p0),
    'org.w3c.workers.delete_$external_fun' : (_this, p0) => _this.delete(p0),
    'kotlinx.browser.window_$external_prop_getter' : () => window,
    'kotlinx.browser.document_$external_prop_getter' : () => document,
    'org.w3c.dom.length_$external_prop_getter' : (_this) => _this.length,
    'androidx.compose.runtime.internal.weakMap_js_code' : () => (new WeakMap()),
    'androidx.compose.runtime.internal.set_$external_fun' : (_this, p0, p1) => _this.set(p0, p1),
    'androidx.compose.runtime.internal.get_$external_fun' : (_this, p0) => _this.get(p0),
    'androidx.compose.runtime.internal.WeakRef_$external_fun' : (p0) => new WeakRef(p0),
    'androidx.compose.runtime.internal.deref_$external_fun' : (_this, ) => _this.deref(),
    'org.jetbrains.skia.impl.FinalizationRegistry_$external_fun' : (p0) => new FinalizationRegistry(p0),
    'org.jetbrains.skia.impl.register_$external_fun' : (_this, p0, p1, p2) => _this.register(p0, p1, p2),
    'org.jetbrains.skia.impl.unregister_$external_fun' : (_this, p0) => _this.unregister(p0),
    'org.jetbrains.skia.impl._releaseLocalCallbackScope_$external_fun' : () => _ref_Li9za2lrby5tanM_c2tpa29BcGk._releaseLocalCallbackScope(),
    'org.jetbrains.skiko.currentNanoTimeWindowPerformance' : () => window.performance.now() * 1000000,
    'org.jetbrains.skiko.getNavigatorInfo' : () => navigator.userAgentData ? navigator.userAgentData.platform : navigator.platform,
    'androidx.lifecycle.WeakRef_$external_fun' : (p0) => new WeakRef(p0),
    'androidx.lifecycle.deref_$external_fun' : (_this, ) => _this.deref(),
    'androidx.compose.ui.text.WeakRef_$external_fun' : (p0) => new WeakRef(p0),
    'androidx.compose.ui.text.deref_$external_fun' : (_this, ) => _this.deref(),
    'androidx.compose.ui.text.intl.parseLanguageTagToIntlLocale' : (languageTag) => new Intl.Locale(languageTag),
    'androidx.compose.ui.text.intl.addLanguageChangeListener' : (listener) => { window.addEventListener?.('languagechange', listener) },
    'androidx.compose.ui.text.intl.getUserPreferredLanguagesAsArray' : () => window.navigator.languages,
    'androidx.compose.ui.text.intl._language_$external_prop_getter' : (_this) => _this.language,
    'androidx.compose.ui.text.intl._script_$external_prop_getter' : (_this) => _this.script,
    'androidx.compose.ui.text.intl._region_$external_prop_getter' : (_this) => _this.region,
    'androidx.compose.ui.text.intl._baseName_$external_prop_getter' : (_this) => _this.baseName,
    'androidx.compose.ui.text.FinalizationRegistry_$external_fun' : (p0) => new FinalizationRegistry(p0),
    'androidx.compose.ui.text.register_$external_fun' : (_this, p0, p1) => _this.register(p0, p1),
    'androidx.compose.ui.text.WeakRef_$external_fun_1' : (p0) => new WeakRef(p0),
    'androidx.compose.ui.text.deref_$external_fun_1' : (_this, ) => _this.deref(),
    'androidx.compose.ui.internal.weakMap_js_code' : () => (new WeakMap()),
    'androidx.compose.ui.internal.set_$external_fun' : (_this, p0, p1) => _this.set(p0, p1),
    'androidx.compose.ui.internal.get_$external_fun' : (_this, p0) => _this.get(p0),
    'androidx.compose.ui.platform.createClipboardItemWithPlainText' : (text) => [new ClipboardItem({'text/plain': new Blob([text], { type: 'text/plain' })})],
    'androidx.compose.ui.platform.emptyClipboardItems' : () => [new ClipboardItem({'text/plain': new Blob([''], { type: 'text/plain' })})],
    'androidx.compose.ui.platform.invalidClipboardItems' : () => [],
    'androidx.compose.ui.platform.warn' : (text) => { console.warn(text) },
    'androidx.compose.ui.node.WeakRef_$external_fun' : (p0) => new WeakRef(p0),
    'androidx.compose.ui.node.deref_$external_fun' : (_this, ) => _this.deref(),
    'androidx.compose.ui.platform.getW3CClipboard' : () => window.navigator.clipboard,
    'androidx.compose.ui.platform.isSecureContext' : () => window.isSecureContext === true,
    'androidx.compose.ui.platform.isFullClipboardApiSupported' : () => Boolean(
            window.navigator.clipboard && 
            window.navigator.clipboard.write && 
            window.navigator.clipboard.read && 
            typeof(ClipboardItem) !== 'undefined'
            )
        ,
    'androidx.compose.ui.platform.isFallbackWriteTextApiAvailable' : () => Boolean(window.navigator.clipboard && window.navigator.clipboard.writeText),
    'androidx.compose.ui.platform.read_$external_fun' : (_this, ) => _this.read(),
    'androidx.compose.ui.platform.write_$external_fun' : (_this, p0) => _this.write(p0),
    'androidx.compose.ui.platform.writeText_$external_fun' : (_this, p0) => _this.writeText(p0),
    'androidx.compose.ui.platform.W3CTemporaryClipboard_$external_class_instanceof' : (x) => x instanceof Clipboard,
    'androidx.compose.ui.platform.W3CTemporaryClipboard_$external_class_get' : () => Clipboard,
    'androidx.compose.ui.platform.types_$external_prop_getter' : (_this) => _this.types,
    'androidx.compose.ui.platform.getType_$external_fun' : (_this, p0) => _this.getType(p0),
    'androidx.compose.ui.platform.isSchedulerApiSupported' : () => Boolean('scheduler' in window),
    'androidx.compose.ui.platform.isIdleApiSupported' : () => Boolean('requestIdleCallback' in window),
    'androidx.compose.ui.platform.isFullWakeLockApiSupported' : () => Boolean(
            window.navigator.wakeLock && 
            typeof(WakeLockSentinel) !== 'undefined'
            )
        ,
    'androidx.compose.foundation.internal.isClipboardWriteSupported' : () => Boolean(window.navigator.clipboard && (window.navigator.clipboard.write || window.navigator.clipboard.writeText)),
    'androidx.compose.foundation.internal.isClipboardReadSupported' : () => Boolean(window.navigator.clipboard && window.navigator.clipboard.read),
    'androidx.compose.foundation.internal.getTextFromBlob' : (blob) => blob.text(),
    'androidx.compose.foundation.internal.doesJsArrayContainValue' : (jsArray, value) => jsArray.includes(value),
    'androidx.compose.foundation.text.EventListener' : (handler) => (event) => { handler(event) },
    'androidx.compose.foundation.gestures.legacyWheelDeltaX' : (event) => (event.wheelDeltaX == null) ? NaN : event.wheelDeltaX,
    'androidx.compose.foundation.gestures.legacyWheelDeltaY' : (event) => (event.wheelDeltaY == null) ? NaN : event.wheelDeltaY,
    'androidx.compose.material.internal.weakMap_js_code' : () => (new WeakMap()),
    'androidx.compose.material.internal.set_$external_fun' : (_this, p0, p1) => _this.set(p0, p1),
    'androidx.compose.material.internal.get_$external_fun' : (_this, p0) => _this.get(p0),
    'org.jetbrains.compose.resources.Locale_$external_fun' : (p0) => new Intl.Locale(p0),
    'org.jetbrains.compose.resources.language_$external_prop_getter' : (_this) => _this.language,
    'org.jetbrains.compose.resources.script_$external_prop_getter' : (_this) => _this.script,
    'org.jetbrains.compose.resources.region_$external_prop_getter' : (_this) => _this.region,
    'org.jetbrains.compose.resources.jsExportBlobAsArrayBuffer' : (blob) => blob.arrayBuffer(),
    'org.jetbrains.compose.resources.copyArrayBufferToWasmMemory' : (wasmMemory, ab, ptr) => {
          const data = new Uint8Array(ab);
          new Uint8Array(wasmMemory.buffer).set(data, ptr);
    },
    'org.jetbrains.compose.resources.jsFetchWithSignal' : (url, signal) => window.fetch(url, { signal }),
    'org.jetbrains.compose.resources.AbortController_$external_fun' : () => new AbortController(),
    'org.jetbrains.compose.resources.signal_$external_prop_getter' : (_this) => _this.signal,
    'org.jetbrains.compose.resources.abort_$external_fun' : (_this, ) => _this.abort(),
    'org.jetbrains.compose.resources.supportsCacheApi' : () => Boolean(window.caches),
    'kotlinx.io.node.sep_$external_prop_getter' : (_this) => _this.sep,
    'kotlinx.io.getPlatformName' : 
        () => (typeof navigator !== "undefined" && navigator.platform) || "unknown"
    ,
    'kotlinx.io.node.loadBuffer' : ((module) => () => module)(((typeof process !== 'undefined') && (process.release.name === 'node')) ? await import(/* webpackIgnore: true */'node:buffer') : null),
    'kotlinx.io.node.loadOs' : ((module) => () => module)(((typeof process !== 'undefined') && (process.release.name === 'node')) ? await import(/* webpackIgnore: true */'node:os') : null),
    'kotlinx.io.node.loadPath' : ((module) => () => module)(((typeof process !== 'undefined') && (process.release.name === 'node')) ? await import(/* webpackIgnore: true */'node:path') : null),
    'kotlinx.io.node.loadFs' : ((module) => () => module)(((typeof process !== 'undefined') && (process.release.name === 'node')) ? await import(/* webpackIgnore: true */'node:fs') : null),
    'io.ktor.utils.io.js.decode' : (decoder, buffer) => { try { return decoder.decode(buffer) } catch(e) { return null } },
    'io.ktor.utils.io.js.tryCreateTextDecoder' : (encoding, fatal) => { try { return new TextDecoder(encoding, { fatal: fatal }) } catch(e) { return null } },
    'io.ktor.utils.io.charsets.toJsArrayImpl' : (x) => new Int8Array(x),
    'io.ktor.util.date.Date_$external_fun' : () => new Date(),
    'io.ktor.util.date.Date_$external_fun_1' : (p0) => new Date(p0),
    'io.ktor.util.date.getTime_$external_fun' : (_this, ) => _this.getTime(),
    'io.ktor.util.date.getUTCDate_$external_fun' : (_this, ) => _this.getUTCDate(),
    'io.ktor.util.date.getUTCDay_$external_fun' : (_this, ) => _this.getUTCDay(),
    'io.ktor.util.date.getUTCFullYear_$external_fun' : (_this, ) => _this.getUTCFullYear(),
    'io.ktor.util.date.getUTCHours_$external_fun' : (_this, ) => _this.getUTCHours(),
    'io.ktor.util.date.getUTCMinutes_$external_fun' : (_this, ) => _this.getUTCMinutes(),
    'io.ktor.util.date.getUTCMonth_$external_fun' : (_this, ) => _this.getUTCMonth(),
    'io.ktor.util.date.getUTCSeconds_$external_fun' : (_this, ) => _this.getUTCSeconds(),
    'io.ktor.util.hasNodeApi' : () => 
    (typeof process !== 'undefined' 
        && process.versions != null 
        && process.versions.node != null) ||
    (typeof window !== 'undefined' 
        && typeof window.process !== 'undefined' 
        && window.process.versions != null 
        && window.process.versions.node != null)
    ,
    'io.ktor.util.logging.getKtorLogLevel' : () => process ? process.env.KTOR_LOG_LEVEL : null,
    'io.ktor.util.logging.warn_$external_fun' : (_this, p0) => _this.warn(p0),
    'io.ktor.util.logging.debug_$external_fun' : (_this, p0) => _this.debug(p0),
    'io.ktor.util.logging.console_$external_prop_getter' : () => console,
    'io.ktor.http.locationOrigin' : () => function() {
        var tmpLocation = null
        if (typeof window !== 'undefined') {
          tmpLocation = window.location
        } else if (typeof self !== 'undefined') {
          tmpLocation = self.location
        }
        var origin = ""
        if (tmpLocation) {
          origin = tmpLocation.origin
        }
        return origin && origin != "null" ? origin : "http://localhost"    
    }(),
    'io.ktor.client.engine.js.createBrowserWebSocket' : (urlString_capturingHack, protocols) => new WebSocket(urlString_capturingHack, protocols),
    'io.ktor.client.engine.js.createWebSocketNodeJs' : (socketCtor, urlString_capturingHack, headers_capturingHack, protocols) => new socketCtor(urlString_capturingHack, protocols, { headers: headers_capturingHack }),
    'io.ktor.client.engine.js.getKeys' : (headers) => Array.from(headers.keys()),
    'io.ktor.client.engine.js.compatibility.abortControllerCtorBrowser' : () => AbortController,
    'io.ktor.client.fetch.body_$external_prop_setter' : (_this, v) => _this.body = v,
    'io.ktor.client.fetch.headers_$external_prop_setter' : (_this, v) => _this.headers = v,
    'io.ktor.client.fetch.method_$external_prop_setter' : (_this, v) => _this.method = v,
    'io.ktor.client.fetch.redirect_$external_prop_setter' : (_this, v) => _this.redirect = v,
    'io.ktor.client.fetch.signal_$external_prop_setter' : (_this, v) => _this.signal = v,
    'io.ktor.client.fetch.fetch_$external_fun' : (p0, p1, isDefault0) => fetch(p0, isDefault0 ? undefined : p1, ),
    'io.ktor.client.fetch.signal_$external_prop_getter' : (_this) => _this.signal,
    'io.ktor.client.fetch.abort_$external_fun' : (_this, ) => _this.abort(),
    'io.ktor.client.fetch.getReader_$external_fun' : (_this, ) => _this.getReader(),
    'io.ktor.client.fetch.cancel_$external_fun' : (_this, p0, isDefault0) => _this.cancel(isDefault0 ? undefined : p0, ),
    'io.ktor.client.fetch.read_$external_fun' : (_this, ) => _this.read(),
    'io.ktor.client.fetch.done_$external_prop_getter' : (_this) => _this.done,
    'io.ktor.client.fetch.value_$external_prop_getter' : (_this) => _this.value,
    'io.ktor.client.plugins.websocket.tryGetEventDataAsString' : (data) => typeof(data) === 'string' ? data : null,
    'io.ktor.client.plugins.websocket.tryGetEventDataAsArrayBuffer' : (data) => data instanceof ArrayBuffer ? data : null,
    'io.ktor.client.utils.makeJsObject' : () => { return {}; },
    'io.ktor.client.utils.makeImport' : (name) => import(name),
    'io.ktor.client.utils.makeJsCall' : (func, arg) => func.apply(null, arg),
    'io.ktor.client.utils.jsObjectAssign' : () => Object.assign,
    'io.ktor.client.utils.makeJsNew' : (ctor) => new ctor(),
    'io.ktor.client.utils.getObjectField' : (obj, name) => obj[name],
    'io.ktor.client.utils.setObjectField' : (obj, name, value) => obj[name]=value,
    'io.ktor.client.utils.eventAsString' : (event) => JSON.stringify(event, ['message', 'target', 'type', 'isTrusted']),
    'io.ktor.client.utils.toJsArrayImpl' : (x) => new Uint8Array(x),
    'runGC' : () => { (typeof gc === 'function')? gc() : console.log('Manual GC is not available. Ensure that the browser was started with the appropriate flags.') }
}

const StringConstantsProxy = new Proxy({}, {
  get(_, prop) { return prop; }
});


export { wasmTag as __TAG };

export const importObject = {
    js_code,
    intrinsics: {
        memory: new WebAssembly.Memory({ initial: 0 }),
        tag: wasmTag
    },
    "'": StringConstantsProxy,
    'wasm:js-string': d2FzbTpqcy1zdHJpbmc,
    './skiko.mjs': Li9za2lrby5tanM,
};
