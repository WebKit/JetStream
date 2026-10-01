"use strict";

/*
 * Copyright (C) 2018-2024 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
*/

const measureTotalTimeAsSubtest = false; // Once we move to preloading all resources, it would be good to turn this on.

const defaultIterationCount = 120;
const defaultWorstCaseCount = 4;

if (!JetStreamParams.prefetchResources && isInBrowser) {
    console.warn("Disabling resource prefetching! All compressed files must have been decompressed using `npm run decompress`");
}

if (JetStreamParams.forceGC && typeof globalThis.gc === "undefined") {
    console.warn("Force-gc is set, but globalThis.gc() is not available.");
}

if (!isInBrowser && JetStreamParams.prefetchResources) {
    // Use the wasm compiled zlib as a polyfill when decompression stream is
    // not available in JS shells.
    load("./workloads/zlib-wasm/shell.js");

    // Load a polyfill for TextEncoder/TextDecoder in shells. Used when
    // decompressing a prefetched resource and converting it to text.
    load("./utils/polyfills/fast-text-encoding/1.0.3/text.js");
}

// Used for the promise representing the current benchmark run.
this.currentResolve = null;
this.currentReject = null;

function displayCategoryScores() {
    document.body.classList.add("details");
}


if (isInBrowser) {
    document.onkeydown = (keyboardEvent) => {
        const key = keyboardEvent.key;
        if (key === "d" || key === "D")
            displayCategoryScores();
    };
}

function sum(values) {
    console.assert(values instanceof Array);
    let sum = 0;
    for (let x of values)
        sum += x;
    return sum;
}

function mean(values) {
    const totalSum = sum(values)
    return totalSum / values.length;
}

function geomeanScore(values) {
    console.assert(values instanceof Array);
    let product = 1;
    for (let x of values)
        product *= x;
    const score = product ** (1 / values.length);
    // Allow 0 for uninitialized subScores().
    console.assert(score >= 0, `Got invalid score: ${score}`)
    return score;
}

function toScore(timeValue) {
    return 5000 / Math.max(timeValue, 1);
}

function toTimeValue(score) {
    return 5000 / score;
}

function updateUI() {
    return new Promise((resolve) => {
        if (isInBrowser)
            requestAnimationFrame(() => setTimeout(resolve, 0));
        else
            resolve();
    });
}

function uiFriendlyNumber(num) {
    if (Number.isInteger(num))
        return num;
    return num.toFixed(2);
}

function uiFriendlyScore(num) {
    return uiFriendlyNumber(num);
}

function uiFriendlyDuration(time) {
    return `${time.toFixed(2)} ms`;
}

const LABEL_PADDING = 45;
function shellFriendlyLabel(label) {
    return `${label}`.padEnd(LABEL_PADDING);
}

const VALUE_PADDING = 11;
function shellFriendlyDuration(time) {
    return `${uiFriendlyDuration(time)} `.padStart(VALUE_PADDING);
}

function shellFriendlyScore(time) {
    return `${uiFriendlyScore(time)} pts`.padStart(VALUE_PADDING);
}


// Files can be zlib compressed to reduce the size of the JetStream source code.
// We don't use http compression because we support running from the shell and
// don't want to require a complicated server setup.
//
// zlib was chosen because we already have it in tree for the wasm-zlib test.
function isCompressed(name) {
    return name.endsWith(".z");
}

function uncompressedName(name) {
    console.assert(isCompressed(name));
    return name.slice(0, -2);
}

// TODO: Cleanup / remove / merge. This is only used for caching loads in the
// non-browser setting. In the browser we use exclusively `loadCache`, 
// `loadBlob`, `doLoadBlob`, `prefetchResourcesForBrowser` etc., see below.
class ShellFileLoader {
    constructor() {
        this.requests = new Map;
    }

    // Cache / memoize previously read files, because some workloads
    // share common code.
    load(url) {
        console.assert(!isInBrowser);

        let compressed = isCompressed(url);
        if (compressed && !JetStreamParams.prefetchResources) {
            url = uncompressedName(url);
        }

        // If we aren't supposed to prefetch this then return code snippet that will load the url on-demand.
        if (!JetStreamParams.prefetchResources)
            return `load("${url}");`

        if (this.requests.has(url)) {
            return this.requests.get(url);
        }

        let contents;
        if (compressed) {
            const compressedBytes = new Int8Array(read(url, "binary"));
            const decompressedBytes = zlib.decompress(compressedBytes);
            contents = new TextDecoder().decode(decompressedBytes);
        } else {
            contents = readFile(url);
        }
        this.requests.set(url, contents);
        return contents;
    }
};


class BrowserFileLoader {

    constructor() {
        // TODO: Cleanup / remove / merge `blobDataCache` and `loadCache` vs.
        // the global `fileLoader` cache.
        this.blobDataCache = { __proto__ : null };
        this.loadCache = { __proto__ : null };
    }

    async doLoadBlob(resource) {
        const blobData = this.blobDataCache[resource];

        const compressed = isCompressed(resource);
        if (compressed && !JetStreamParams.prefetchResources) {
            resource = uncompressedName(resource);
        }

        // If we aren't supposed to prefetch this then set the blobURL to just
        // be the resource URL.
        if (!JetStreamParams.prefetchResources) {
            blobData.blobURL = resource;
            return blobData;
        }

        let response;
        let tries = 3;
        while (tries--) {
            let hasError = false;
            try {
                response = await fetch(resource, { cache: "no-store" });
            } catch (e) {
                hasError = true;
            }
            if (!hasError && response.ok)
                break;
            if (tries)
                continue;
            throw new Error("Fetch failed");
        }

        // If we need to decompress this, then run it through a decompression
        // stream.
        if (compressed) {
            const stream = response.body.pipeThrough(new DecompressionStream("deflate"))
            response = new Response(stream);
        }

        let blob = await response.blob();
        blobData.blob = blob;
        blobData.blobURL = URL.createObjectURL(blob);
        return blobData;
    }

    async loadBlob(type, prop, resource, incrementRefCount = true) {
        let blobData = this.blobDataCache[resource];
        if (!blobData) {
            blobData = {
                type: type,
                prop: prop,
                resource: resource,
                blob: null,
                blobURL: null,
                refCount: 0
            };
            this.blobDataCache[resource] = blobData;
        }

        if (incrementRefCount)
            blobData.refCount++;

        let promise = this.loadCache[resource];
        if (promise)
            return promise;

        promise = this.doLoadBlob(resource);
        this.loadCache[resource] = promise;
        return promise;
    }

    async retryPrefetchResource(type, prop, file) {
        console.assert(isInBrowser);

        const counter = JetStream.counter;
        const blobData = this.blobDataCache[file];
        if (blobData.blob) {
            // The same preload blob may be used by multiple subtests. Though the blob is already loaded,
            // we still need to check if this subtest failed to load it before. If so, handle accordingly.
            if (type == "preload") {
                if (this.failedPreloads && this.failedPreloads[blobData.prop]) {
                    this.failedPreloads[blobData.prop] = false;
                    this._preloadBlobData.push({ name: blobData.prop, resource: blobData.resource, blobURLOrPath: blobData.blobURL });
                    counter.failedPreloadResources--;
                }
            }
            return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
        }

        // Retry fetching the resource.
        this.loadCache[file] = null;
        await this.loadBlob(type, prop, file, false).then((blobData) => {
            if (!globalThis.allIsGood)
                return;
            if (blobData.type == "preload")
                this._preloadBlobData.push({ name: blobData.prop, resource: blobData.resource, blobURLOrPath: blobData.blobURL });
            this.updateCounter();
        });

        if (!blobData.blob) {
            globalThis.allIsGood = false;
            throw new Error("Fetch failed");
        }

        return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
    }

    free(files) {
        for (const file of files) {
            const blobData = this.blobDataCache[file];
            // If we didn't prefetch this resource, then no need to free it
            if (!blobData.blob) {
                continue
            }
            blobData.refCount--;
            if (!blobData.refCount)
                this.blobDataCache[file] = undefined;
        }
    }
}

const browserFileLoader = new BrowserFileLoader();
const shellFileLoader = new ShellFileLoader();

class Driver {
    constructor(benchmarks) {
        this.isReady = false;
        this.isDone = false;
        this.errors = [];
        // Make benchmark list unique and sort it.
        this.benchmarks = Array.from(new Set(benchmarks));
        this.benchmarks.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1);
        console.assert(this.benchmarks.length, "No benchmarks selected");
        this.counter = { };
        this.counter.loadedResources = 0;
        this.counter.totalResources = 0;
        this.counter.failedPreloadResources = 0;
    }

    async start() {
        let statusElement = false;
        if (isInBrowser) {
            statusElement = document.getElementById("status");
            statusElement.innerHTML = `<label>Running...</label>`;
        } else if (!JetStreamParams.dumpJSONResults)
            console.log("Starting JetStream3");

        performance.mark("update-ui-start");
        const start = performance.now();
        for (const benchmark of this.benchmarks) {
            performance.mark("update-ui-start");
            benchmark.updateUIBeforeRun();
            await updateUI();
            performance.measure("runner update-ui", "update-ui-start");

            try {
                await benchmark.run();
            } catch(e) {
                this.reportError(benchmark, e);
                throw e;
            }

            performance.mark("update-ui-start");
            benchmark.updateUIAfterRun();
            performance.measure("runner update-ui", "update-ui-start");

            if (isInBrowser) {
                browserFileLoader.free(benchmark.files);
            }
        }

        const totalTime = performance.now() - start;
        if (measureTotalTimeAsSubtest) {
            if (isInBrowser)
                document.getElementById("benchmark-total-time-score").innerHTML = uiFriendlyNumber(totalTime);
            else if (!JetStreamParams.dumpJSONResults)
                console.log("Total-Time:", uiFriendlyNumber(totalTime));
            allScores.push(totalTime);
        }

        const allScores = [];
        for (const benchmark of this.benchmarks) {
            const score = benchmark.score;
            console.assert(score > 0, `Invalid ${benchmark.name} score: ${score}`);
            allScores.push(score);
        }

        const categoryScores = new Map();
        const categoryTimes = new Map();
        for (const benchmark of this.benchmarks) {
            for (let category of Object.keys(benchmark.subScores()))
                categoryScores.set(category, []);
            for (let category of Object.keys(benchmark.subTimes()))
                categoryTimes.set(category, []);
        }

        for (const benchmark of this.benchmarks) {
            for (let [category, value] of Object.entries(benchmark.subScores())) {
                const arr = categoryScores.get(category);
                console.assert(value > 0, `Invalid ${benchmark.name} ${category} score: ${value}`);
                arr.push(value);
            }
            for (let [category, value] of Object.entries(benchmark.subTimes())) {
                const arr = categoryTimes.get(category);
                console.assert(value > 0, `Invalid ${benchmark.name} ${category} time: ${value}`);
                arr.push(value);
            }
        }

        const overallScore = geomeanScore(allScores);
        console.assert(overallScore > 0, `Invalid total score: ${overallScore}`);

        if (isInBrowser) {
            let summaryHtml = `<div class="score">${uiFriendlyScore(overallScore)}</div>
                    <label>Score</label>`;
            summaryHtml += `<div class="benchmark benchmark-done">`;
            for (let [category, scores] of categoryScores) {
                summaryHtml += `<span class="result detail">
                                    <span>${uiFriendlyScore(geomeanScore(scores))}</span>
                                    <label>${category}</label>
                                </span>`;
            }
            summaryHtml += "<br/>";
            for (let [category, times] of categoryTimes) {
                summaryHtml += `<span class="result detail">
                                    <span>${uiFriendlyDuration(geomeanScore(times))}</span>
                                    <label>${category}</label>
                                </span>`;
            }
            summaryHtml += "</div>";
            const summaryElement = document.getElementById("result-summary");
            summaryElement.classList.add("done");
            summaryElement.innerHTML = summaryHtml;
            summaryElement.onclick = displayCategoryScores;
            statusElement.innerHTML = "";
        } else if (!JetStreamParams.dumpJSONResults) {
            console.log("Overall:");
            for (let [category, scores] of categoryScores) {
                console.log(
                    shellFriendlyLabel(`Overall ${category}-Score`),
                    shellFriendlyScore(geomeanScore(scores)));
            }
            for (let [category, times] of categoryTimes) {
                console.log(
                    shellFriendlyLabel(`Overall ${category}-Time`),
                    shellFriendlyDuration(geomeanScore(times)));
            }
            console.log("");
            console.log(shellFriendlyLabel("Overall Score"), shellFriendlyScore(overallScore));
            console.log(shellFriendlyLabel("Overall Wall-Time"), shellFriendlyDuration(totalTime));
            console.log("");
        }

        this.reportScoreToRunBenchmarkRunner();
        this.dumpJSONResultsIfNeeded();
        this.isDone = true;

        if (isInBrowser) {
            globalThis.dispatchEvent(new CustomEvent("JetStreamDone", {
                detail: this.resultsObject()
            }));
        }
    }

    prepareBrowserUI() {
        let text = "";
        for (const benchmark of this.benchmarks)
            text += benchmark.renderHTML();

        const resultsTable = document.getElementById("results");
        resultsTable.innerHTML = text;

        document.getElementById("magic").textContent = "";
        document.addEventListener('keypress', (e) => {
            if (e.key === "Enter")
                JetStream.start();
        });
    }

    reportError(benchmark, error) {
        this.pushError(benchmark.name, error);

        if (!isInBrowser)
            return;

        for (const id of benchmark.allScoreIdentifiers())
            document.getElementById(id).innerHTML = "error";
        for (const id of benchmark.allTimeIdentifiers())
            document.getElementById(id).innerHTML = "error";
        const benchmarkResultsUI = document.getElementById(`benchmark-${benchmark.name}`);
        benchmarkResultsUI.classList.remove("benchmark-running");
        benchmarkResultsUI.classList.add("benchmark-error");
    }

    pushError(name, error) {
        this.errors.push({
            benchmark: name,
            error: error.toString(),
            stack: error.stack
        });
    }

    async initialize() {
        if (isInBrowser)
            window.addEventListener("error", (e) => this.pushError("driver startup", e.error));
        await this.prefetchResources();
        this.benchmarks.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1);
        if (isInBrowser)
            this.prepareBrowserUI();
        this.isReady = true;
        if (isInBrowser) {
            globalThis.dispatchEvent(new Event("JetStreamReady"));
            if (typeof(JetStreamParams.startDelay) !== "undefined") {
                setTimeout(() => this.start(), JetStreamParams.startDelay);
            }
        }
    }

    async prefetchResources() {
        if (!isInBrowser) {
            if (JetStreamParams.prefetchResources) {
                await zlib.initialize();
            }
            for (const benchmark of this.benchmarks)
                benchmark.prefetchResourcesForShell();
            return;
        }

        // TODO: Cleanup the browser path of the preloading below and in
        // `prefetchResourcesForBrowser` / `retryPrefetchResourcesForBrowser`.
        const counter = JetStream.counter;
        const promises = [];
        for (const benchmark of this.benchmarks)
            promises.push(benchmark.prefetchResourcesForBrowser(counter));
        await Promise.all(promises);

        if (counter.failedPreloadResources || counter.loadedResources != counter.totalResources) {
            for (const benchmark of this.benchmarks) {
                const allFilesLoaded = await benchmark.retryPrefetchResourcesForBrowser(counter);
                if (allFilesLoaded)
                    break;
            }

            if (counter.failedPreloadResources || counter.loadedResources != counter.totalResources) {
                // If we've failed to prefetch resources even after a sequential 1 by 1 retry,
                // then fail out early rather than letting subtests fail with a hang.
                globalThis.allIsGood = false;
                throw new Error("Fetch failed");
            }
        }

        JetStream.loadCache = { }; // Done preloading all the files.

        const statusElement = document.getElementById("status");
        statusElement.classList.remove('loading');
        statusElement.innerHTML = `<a href="javascript:JetStream.start()" class="button">Start Test</a>`;
        statusElement.onclick = () => {
            statusElement.onclick = null;
            JetStream.start();
            return false;
        }
    }

    updateCounterUI() {
        const counter = JetStream.counter;
        const statusElement = document.getElementById("status-text");
        statusElement.innerText = `Loading ${counter.loadedResources} of ${counter.totalResources} ...`;

        const percent = (counter.loadedResources / counter.totalResources) * 100;
        const progressBar = document.getElementById("status-progress-bar");
        progressBar.style.width = `${percent}%`;
    }

    resultsObject(format = "run-benchmark") {
        switch(format) {
            case "run-benchmark":
                return this.runBenchmarkResultsObject();
            case "simple":
                return this.simpleResultsObject();
            default:
                throw Error(`Unknown result format '${format}'`);
        }
    }

    runBenchmarkResultsObject()
    {
        let results = {};
        for (const benchmark of this.benchmarks) {
            const subResults = {}
            const subScores = benchmark.subScores();
            for (const name in subScores) {
                subResults[name] = {"metrics": {"Time": {"current": [toTimeValue(subScores[name])]}}};
            }
            results[benchmark.name] = {
                "metrics" : {
                    "Score" : {"current" : [benchmark.score]},
                    "Time": ["Geometric"],
                },
                "tests": subResults,
            };
        }

        results = {"JetStream3.0": {"metrics" : {"Score" : ["Geometric"]}, "tests" : results}};
        return results;
    }

    simpleResultsObject() {
        const results = {__proto__: null};
        for (const benchmark of this.benchmarks) {
            if (!benchmark.isDone)
                continue;
            if (!benchmark.isSuccess) {
                results[benchmark.name] = "FAILED";
            } else {
                results[benchmark.name] = {
                    Score: benchmark.score,
                    ...benchmark.subScores(),

                };
            }
        }
        return results;
    }

    resultsJSON(format = "run-benchmark")
    {
        return JSON.stringify(this.resultsObject(format));
    }

    dumpJSONResultsIfNeeded()
    {
        if (JetStreamParams.dumpJSONResults) {
            console.log("\n");
            console.log(this.resultsJSON());
            console.log("\n");
        }
    }

    dumpTestList()
    {
        for (const benchmark of this.benchmarks) {
            console.log(benchmark.name);
        }
    }

    async reportScoreToRunBenchmarkRunner()
    {
        if (!isInBrowser)
            return;

        if (!JetStreamParams.report)
            return;

        const content = this.resultsJSON();
        await fetch("/report", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Content-Length": content.length,
                "Connection": "close",
            },
            body: content,
        });
    }
};

const BenchmarkState = Object.freeze({
    READY: "READY",
    SETUP: "SETUP",
    RUNNING: "RUNNING",
    FINALIZE: "FINALIZE",
    ERROR: "ERROR",
    DONE: "DONE"
})


class Scripts {
    constructor(preloads) {
        this.scripts = [];

        let preloadsCode = "";
        let resourcesCode = "";
        for (let { name, resource, blobURLOrPath } of preloads) {
            console.assert(name?.length > 0, "Invalid preload name.");
            console.assert(resource?.length > 0, "Invalid preload resource.");
            console.assert(blobURLOrPath?.length > 0, "Invalid preload data.");
            preloadsCode += `${JSON.stringify(name)}: "${blobURLOrPath}",\n`;
            resourcesCode += `${JSON.stringify(resource)}: "${blobURLOrPath}",\n`;
        }
        // Expose a globalThis.JetStream object to the workload. We use
        // a proxy to prevent prototype access and throw on unknown properties.
        this.add(`
            const throwOnAccess = (name) => new Proxy({},  {
                get(target, property, receiver) {
                    throw new Error(name + "." + property + " is not defined.");
                }
            });
            globalThis.JetStream = {
                __proto__: throwOnAccess("JetStream"),
                preload: {
                    __proto__: throwOnAccess("JetStream.preload"),
                    ${preloadsCode}
                },
                resources: {
                    __proto__: throwOnAccess("JetStream.preload"),
                    ${resourcesCode}
                },
            };
            `);
        this.add(`
            performance.mark ??= function(name) { return { name }};
            performance.measure ??= function() {};
            performance.timeOrigin ??= performance.now();
        `);
    }


    run() {
        throw new Error("Subclasses need to implement this");
    }

    add(text) {
        throw new Error("Subclasses need to implement this");
    }

    addWithURL(url) {
        throw new Error("addWithURL not supported");
    }

    addBrowserTest() {
        this.add(`
            globalThis.JetStream.isInBrowser = ${isInBrowser};
            globalThis.JetStream.isD8 = ${isD8};
        `);
    }

    addDeterministicRandom() {
        this.add(`(() => {
            const initialSeed = 49734321;
            let seed = initialSeed;

            Math.random = () => {
                // Robert Jenkins' 32 bit integer hash function.
                seed = ((seed + 0x7ed55d16) + (seed << 12))  & 0xffff_ffff;
                seed = ((seed ^ 0xc761c23c) ^ (seed >>> 19)) & 0xffff_ffff;
                seed = ((seed + 0x165667b1) + (seed << 5))   & 0xffff_ffff;
                seed = ((seed + 0xd3a2646c) ^ (seed << 9))   & 0xffff_ffff;
                seed = ((seed + 0xfd7046c5) + (seed << 3))   & 0xffff_ffff;
                seed = ((seed ^ 0xb55a4f09) ^ (seed >>> 16)) & 0xffff_ffff;
                // Note that Math.random should return a value that is
                // greater than or equal to 0 and less than 1. Here, we
                // cast to uint32 first then divided by 2^32 for double.
                return (seed >>> 0) / 0x1_0000_0000;
            };

            Math.random.__resetSeed = () => {
                seed = initialSeed;
            };
        })();`);
    }
}

class ShellScripts extends Scripts {
    constructor(preloads) {
        super(preloads);
        this.prefetchedResources = Object.create(null);;
    }

    run() {
        let globalObject;
        let realm;
        if (isD8) {
            realm = Realm.createAllowCrossRealmAccess();
            globalObject = Realm.global(realm);
            globalObject.loadString = function(s) {
                return Realm.eval(realm, s);
            };
            globalObject.readFile = read;
        } else if (isSpiderMonkey) {
            globalObject = newGlobal();
            globalObject.loadString = globalObject.evaluate;
            globalObject.readFile = globalObject.readRelativeToScript;
        } else
            globalObject = runString("");

        // Expose console copy in the realm so we don't accidentally modify
        // the original object.
        globalObject.console = Object.assign({}, console);
        globalObject.self = globalObject;
        globalObject.top = {
            currentResolve,
            currentReject
        };

        // Pass the prefetched resources to the benchmark global.
        if (JetStreamParams.prefetchResources) {
            // Pass the 'TextDecoder' polyfill into the benchmark global. Don't
            // use 'TextDecoder' as that will get picked up in the kotlin test
            // without full support.
            globalObject.ShellTextDecoder = TextDecoder;
            // Store shellPrefetchedResources on ShellPrefetchedResources so that
            // getBinary and getString can find them.
            globalObject.ShellPrefetchedResources = this.prefetchedResources;
        } else {
            console.assert(Object.values(this.prefetchedResources).length === 0, "Unexpected prefetched resources");
        }

        globalObject.performance ??= performance;
        for (const script of this.scripts)
            globalObject.loadString(script);

        return isD8 ? realm : globalObject;
    }

    addPrefetchedResources(prefetchedResources) {
        for (let [file, bytes] of Object.entries(prefetchedResources)) {
            this.prefetchedResources[file] = bytes;
        }
    }

    add(text) {
        this.scripts.push(text);
    }

    addWithURL(url) {
        console.assert(false, "Should not reach here in CLI");
    }
}

class BrowserScripts extends Scripts {
    constructor(preloads) {
        super(preloads);
        this.add("window.onerror = top.currentReject;");
    }

    run() {
        const string = this.scripts.join("\n");
        const magic = document.getElementById("magic");
        magic.contentDocument.body.textContent = "";
        magic.contentDocument.body.innerHTML = `<iframe id="magicframe" frameborder="0">`;

        const magicFrame = magic.contentDocument.getElementById("magicframe");
        magicFrame.contentDocument.open();
        magicFrame.contentDocument.write(`<!DOCTYPE html>
            <head>
               <title>benchmark payload</title>
            </head>
            <body>${string}</body>
        </html>`);
        return magicFrame;
    }

    add(text) {
        this.scripts.push(`<script>${text}</script>`);
    }

    addWithURL(url) {
        this.scripts.push(`<script src="${url}"></script>`);
    }
}


class Benchmark {
    constructor({
            name, 
            files,
            preload = {},
            tags, 
            iterations,
            deterministicRandom = false,
            exposeBrowserTest = false,
            allowUtf16 = false,
            args = {} }) {
        this._state = BenchmarkState.READY;
        this.results = [];

        this.name = name
        this.tags = this._processTags(tags)
        this._arguments = args;
        
        this.iterations = this._processIterationCount(iterations);
        this._deterministicRandom = deterministicRandom;
        this._exposeBrowserTest = exposeBrowserTest;
        this.allowUtf16 = !!allowUtf16;

        // Resource handling:
        this._scripts = null;
        this._files = files;
        this._preloadEntries = Object.entries(preload);
        this._preloadBlobData = [];
        this._shellPrefetchedResources = null;
    }

    // Use getter so it can be overridden in subclasses (GroupedBenchmark).
    get files() {
        return this._files;
    }
    get preloadEntries() { 
        return this._preloadEntries;
    }

    _processTags(rawTags) {
        const tags = new Set(rawTags.map(each => each.toLowerCase()));
        if (tags.size != rawTags.length)
            throw new Error(`${this.name} got duplicate tags: ${rawTags.join()}`);
        tags.add("all");
        if (!tags.has("default"))
            tags.add("disabled");
        return tags;
    }

    _processIterationCount(iterations) {
        if (this.name in JetStreamParams.testIterationCountMap)
            return JetStreamParams.testIterationCountMap[this.name];
        if (JetStreamParams.testIterationCount)
            return JetStreamParams.testIterationCount;
        if (iterations)
            return iterations;
        return defaultIterationCount;
    }

    _processWorstCaseCount(worstCaseCount) {
        if (this.name in JetStreamParams.testWorstCaseCountMap)
            return JetStreamParams.testWorstCaseCountMap[this.name];
        if (JetStreamParams.testWorstCaseCount)
            return JetStreamParams.testWorstCaseCount;
        if (worstCaseCount !== undefined)
            return worstCaseCount;
        return defaultWorstCaseCount;
    }

    get isDone() {
        return this._state == BenchmarkState.DONE || this._state == BenchmarkState.ERROR;
    }
    get isSuccess() { return this._state = BenchmarkState.DONE; }

    hasAnyTag(...tags) {
        return tags.some((tag) => this.tags.has(tag.toLowerCase()));
    }

    get benchmarkArguments() {
        return {
            ...this._arguments,
            iterationCount: this.iterations,
        };
    }

    get runnerCode() {
        return `{
            const benchmark = new Benchmark(${JSON.stringify(this.benchmarkArguments)});
            const results = [];
            const benchmarkName = "${this.name}";

            for (let i = 0; i < ${this.iterations}; i++) {
                ${this.preIterationCode}

                const iterationMarkLabel = benchmarkName + "-iteration-" + i;
                const iterationStartMark = performance.mark(iterationMarkLabel);

                const start = performance.now();
                benchmark.runIteration(i);
                const end = performance.now();

                performance.measure(iterationMarkLabel, iterationMarkLabel);

                ${this.postIterationCode}

                results.push(Math.max(1, end - start));
            }
            benchmark.validate?.(${this.iterations});
            top.currentResolve(results);
        };`;
    }

    processResults(results) {
        this.results = Array.from(results);
        return this.results;
    }

    get score() {
        const subScores = Object.values(this.subScores());
        return geomeanScore(subScores);
    }

    get totalTime() {
        const subTimes = Object.values(this.subTimes());
        return sum(subTimes);
    }

    get wallTime() {
        return this.endTime - this.startTime;
    }

    subScores() {
        throw new Error("Subclasses need to implement this");
    }

    subTimes() {
        throw new Error("Subclasses need to implement this");
    }

    allScores() {
        const allScores = this.subScores();
        allScores["Score"] = this.score;
        return allScores;
    }

    allTimes() {
        const allTimes = this.subTimes();
        allTimes["Total"] = this.totalTime;
        allTimes["Wall"] = this.wallTime;
        return allTimes;
    }

    get prerunCode() { return null; }


    get preIterationCode() {
        let code = this.prepareForNextIterationCode ;
        if (this._deterministicRandom)
            code += `Math.random.__resetSeed();`;

        if (JetStreamParams.customPreIterationCode)
            code += JetStreamParams.customPreIterationCode;

        return code;
    }

    get prepareForNextIterationCode() {
        return "benchmark.prepareForNextIteration?.();"
    }

    get postIterationCode() {
        let code = "";

        if (JetStreamParams.customPostIterationCode)
            code += JetStreamParams.customPostIterationCode;

        return code;
    }

    renderHTML() {
        const scoreDescription = Object.keys(this.allScores());
        const timeDescription = Object.keys(this.allTimes());

        const scoreIds = this.allScoreIdentifiers();
        const overallScoreId = scoreIds.pop();
        const timeIds = this.allTimeIdentifiers();
        let text = `<div class="benchmark" id="benchmark-${this.name}">
            <h3 class="benchmark-name">${this.name} <a class="info" href="in-depth.html#${this.name}">i</a></h3>
            <h4 class="score" id="${overallScoreId}">&nbsp;</h4>
            <h4 class="plot" id="plot-${this.name}">&nbsp;</h4>
            <p>`;
        for (let i = 0; i < scoreIds.length; i++) {
            const scoreId = scoreIds[i];
            const label = scoreDescription[i];
            text += `<span class="result"><span id="${scoreId}">&nbsp;</span><label>${label}</label></span>`;
        }
        text += "<br/>";
        for (let i = 0; i < timeIds.length; i++) {
            const timeId = timeIds[i];
            const label = timeDescription[i];
            text += `<span class="result detail"><span id="${timeId}">&nbsp;</span><label>${label}</label></span>`;
        }
        text += `</p></div>`;
        return text;
    }

    async run() {
        if (this.isDone)
            throw new Error(`Cannot run Benchmark ${this.name} twice`);
        this._state = BenchmarkState.PREPARE;

        if (JetStreamParams.forceGC) {
            // This will trigger for individual benchmarks in
            // GroupedBenchmarks since they delegate .run() to their inner
            // non-grouped benchmarks.
            globalThis?.gc();
        }

        const scripts = isInBrowser ? 
                new BrowserScripts(this._preloadBlobData) :
                new ShellScripts(this._preloadBlobData);

        if (this._deterministicRandom)
            scripts.addDeterministicRandom()
        if (this._exposeBrowserTest)
            scripts.addBrowserTest();

        if (this._shellPrefetchedResources) {
            scripts.addPrefetchedResources(this._shellPrefetchedResources);
        }

        const prerunCode = this.prerunCode;
        if (prerunCode)
            scripts.add(prerunCode);

        if (!isInBrowser) {
            console.assert(this._scripts && this._scripts.length === this.files.length);
            for (const text of this._scripts)
                scripts.add(text);
        } else {
            const cache = browserFileLoader.blobDataCache;
            for (const file of this.files) {
                scripts.addWithURL(cache[file].blobURL);
            }
        }

        const promise = new Promise((resolve, reject) => {
            currentResolve = resolve;
            currentReject = reject;
        });

        scripts.add(this.runnerCode);

        performance.mark(this.name);
        this.startTime = performance.now();

        if (JetStreamParams.RAMification)
            resetMemoryPeak();

        let magicFrame;
        try {
            this._state = BenchmarkState.RUNNING;
            magicFrame = scripts.run();
        } catch(e) {
            this._state = BenchmarkState.ERROR;
            console.log("Error in runCode: ", e);
            console.log(e.stack);
            throw e;
        } finally {
            this._state = BenchmarkState.FINALIZE;
        }
        const results = await promise;

        this.endTime = performance.now();
        performance.measure(this.name, this.name);

        if (JetStreamParams.RAMification) {
            const memoryFootprint = MemoryFootprint();
            this.currentFootprint = memoryFootprint.current;
            this.peakFootprint = memoryFootprint.peak;
        }

        this.processResults(results);
        this._state = BenchmarkState.DONE;

        if (isInBrowser)
            magicFrame.contentDocument.close();
        else if (isD8)
            Realm.dispose(magicFrame);
    }


    updateCounter() {
        const counter = JetStream.counter;
        ++counter.loadedResources;
        JetStream.updateCounterUI();
    }

    prefetchResourcesForBrowser(counter) {
        console.assert(isInBrowser);

        const promises = this.files.map((file) => browserFileLoader.loadBlob("file", null, file).then((blobData) => {
                if (!globalThis.allIsGood)
                    return;
                this.updateCounter();
            }).catch((error) => {
                // We'll try again later in retryPrefetchResourceForBrowser(). Don't throw an error.
            }));

        for (const [name, resource] of this.preloadEntries) {
            promises.push(browserFileLoader.loadBlob("preload", name, resource).then((blobData) => {
                if (!globalThis.allIsGood)
                    return;
                this._preloadBlobData.push({ name: blobData.prop, resource: blobData.resource, blobURLOrPath: blobData.blobURL });
                this.updateCounter();
            }).catch((error) => {
                // We'll try again later in retryPrefetchResourceForBrowser(). Don't throw an error.
                if (!this.failedPreloads)
                    this.failedPreloads = { };
                this.failedPreloads[name] = true;
                counter.failedPreloadResources++;
            }));
        }

        JetStream.counter.totalResources += promises.length;
        return Promise.all(promises);
    }

    async retryPrefetchResourcesForBrowser(counter) {
        // FIXME: Move to BrowserFileLoader.
        console.assert(isInBrowser);

        for (const resource of this.files) {
            const allDone = await browserFileLoader.retryPrefetchResource("file", null, resource);
            
            if (allDone)
                return true; // All resources loaded, nothing more to do.
        }

        for (const [name, resource] of this.preloadEntries) {
            const allDone = await browserFileLoader.retryPrefetchResource("preload", name, resource);
            if (allDone)
                return true; // All resources loaded, nothing more to do.
        }
        return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
    }

    prefetchResourcesForShell() {
        // FIXME: move to ShellFileLoader.
        console.assert(!isInBrowser);

        console.assert(this._scripts === null, "This initialization should be called only once.");
        this._scripts = this.files.map(file => shellFileLoader.load(file));

        console.assert(this._preloadBlobData.length === 0, "This initialization should be called only once.");
        this._shellPrefetchedResources = Object.create(null);
        for (let [name, resource] of this.preloadEntries) {
            const compressed = isCompressed(resource);
            if (compressed && !JetStreamParams.prefetchResources) {
                resource = uncompressedName(resource);
            }

            if (JetStreamParams.prefetchResources) {
                let bytes = new Int8Array(read(resource, "binary"));
                if (compressed) {
                    bytes = zlib.decompress(bytes);
                }
                this._shellPrefetchedResources[resource] = bytes;
            }

            this._preloadBlobData.push({ name, resource, blobURLOrPath: resource });
        }
    }

    allScoreIdentifiers() {
        const ids = Object.keys(this.allScores()).map(name => this.scoreIdentifier(name));
        return ids;
    }

    scoreIdentifier(scoreName) {
        return `results-cell-${this.name}-${scoreName}`;
    }

    allTimeIdentifiers() {
        const ids = Object.keys(this.allTimes()).map(name => this.timeIdentifier(name));
        return ids;
    }

    timeIdentifier(scoreName) {
        return `results-cell-${this.name}-${scoreName}-time`;
    }    

    updateUIBeforeRun() {
        if (!JetStreamParams.dumpJSONResults)
            this.updateConsoleBeforeRun();
        if (isInBrowser)
            this.updateUIBeforeRunInBrowser();
    }

    updateConsoleBeforeRun() {
        console.log(`Running ${this.name}:`);
    }

    updateUIBeforeRunInBrowser() {
        const resultsBenchmarkUI = document.getElementById(`benchmark-${this.name}`);
        resultsBenchmarkUI.classList.add("benchmark-running");
        resultsBenchmarkUI.scrollIntoView({ block: "nearest" });

        for (const id of this.allScoreIdentifiers())
            document.getElementById(id).innerHTML = "...";
        for (const id of this.allTimeIdentifiers())
            document.getElementById(id).innerHTML = "...";
    }

    updateUIAfterRun() {
        if (isInBrowser)
            this.updateUIAfterRunInBrowser();
        if (JetStreamParams.dumpJSONResults)
            return;
        this.updateConsoleAfterRun();
    }

    updateUIAfterRunInBrowser() {
        const benchmarkResultsUI = document.getElementById(`benchmark-${this.name}`);
        benchmarkResultsUI.classList.remove("benchmark-running");
        benchmarkResultsUI.classList.add("benchmark-done");

        for (const [name, value] of Object.entries(this.allScores()))
            document.getElementById(this.scoreIdentifier(name)).innerHTML = uiFriendlyScore(value);
        for (const [name, value] of Object.entries(this.allTimes()))
            document.getElementById(this.timeIdentifier(name)).innerHTML = uiFriendlyDuration(value);

        this.renderScatterPlot();
    }

    updateConsoleAfterRun() {
        for (let [name, value] of Object.entries(this.allScores())) {
            if (!name.endsWith("Score"))
                name = `${name}-Score`;

            this.logMetric(name, shellFriendlyScore(value));
        }
        for (let [name, value] of Object.entries(this.allTimes())) {
            this.logMetric(`${name}-Time`, shellFriendlyDuration(value));
        }
        if (JetStreamParams.RAMification) {
            this.logMetric("Current Footprint", uiFriendlyNumber(this.currentFootprint));
            this.logMetric("Peak Footprint", uiFriendlyNumber(this.peakFootprint));
        }
        console.log("");
    }

    logMetric(name, value) {
        console.log(
            shellFriendlyLabel(`${this.name} ${name}`),
            value);
    }    

    renderScatterPlot() {
        const plotContainer = document.getElementById(`plot-${this.name}`);
        if (!plotContainer || !this.results || this.results.length === 0)
            return;

        const scores = this.results.map(time => toScore(time));
        const scoreElement = document.getElementById(this.scoreIdentifier("Score"));
        const width = scoreElement.offsetWidth;
        const height = scoreElement.offsetHeight;

        const padding = 5;
        const maxResult = Math.max(...scores);
        const minResult = Math.min(...scores);

        const xRatio = (width - 2 * padding) / (scores.length - 1 || 1);
        const yRatio = (height - 2 * padding) / (maxResult - minResult || 1);
        const radius = Math.max(1.5, Math.min(2.5, 10 - (this.iterations / 10)));

        let circlesSVG = "";
        for (let i = 0; i < scores.length; i++) {
            const result = scores[i];
            const cx = padding + i * xRatio;
            const cy = height - padding - (result - minResult) * yRatio;
            const title = `Iteration ${i + 1}: ${uiFriendlyScore(result)} (${uiFriendlyDuration(this.results[i])})`;
            circlesSVG += `<circle cx="${cx}" cy="${cy}" r="${radius}"><title>${title}</title></circle>`;
        }
        plotContainer.innerHTML = `<svg width="${width}px" height="${height}px">${circlesSVG}</svg>`;
    }
};

class GroupedBenchmark extends Benchmark {
    constructor(plan, benchmarks) {
        super(plan);
        console.assert(benchmarks.length);
        for (const benchmark of benchmarks) {
            // FIXME: Tags don't work for grouped tests anyway but if they did then this would be weird and probably wrong.
            console.assert(!benchmark.hasAnyTag("Default"), `Grouped benchmark sub-benchmarks shouldn't have the "Default" tag`, benchmark.tags);
        }
        benchmarks.sort((a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? 1 : -1);
        this.benchmarks = benchmarks;
    }

    async prefetchResourcesForBrowser(counter) {
        for (const benchmark of this.benchmarks)
            await benchmark.prefetchResourcesForBrowser(counter);
    }

    async retryPrefetchResourcesForBrowser(counter) {
        for (const benchmark of this.benchmarks)
            await benchmark.retryPrefetchResourcesForBrowser(counter);
    }

    prefetchResourcesForShell() {
        for (const benchmark of this.benchmarks)
            benchmark.prefetchResourcesForShell();
    }
    
    renderHTML() {
        let text = super.renderHTML();
        if (JetStreamParams.groupDetails) {
            for (const benchmark of this.benchmarks)
                text += benchmark.renderHTML();
        }
        return text;
    }

    updateConsoleBeforeRun() {
        if (!JetStreamParams.groupDetails)
            super.updateConsoleBeforeRun();
    }
    
    updateConsoleAfterRun(scoreEntries) {
        if (JetStreamParams.groupDetails)
            super.updateConsoleBeforeRun();
        super.updateConsoleAfterRun(scoreEntries);
    }

    get files() {
        return this.benchmarks.flatMap(benchmark => benchmark.files)
    }

    get preloadEntries() {
        return this.benchmarks.flatMap(benchmark => benchmark.preloadEntries)
    }

    async run() {
        this._state = BenchmarkState.PREPARE;
        performance.mark(this.name);
        this.startTime = performance.now();

        let benchmark;
        try {
            this._state = BenchmarkState.RUNNING;
            for (benchmark of this.benchmarks) {
                if (JetStreamParams.groupDetails)
                    benchmark.updateUIBeforeRun();
                await benchmark.run();
                if (JetStreamParams.groupDetails)
                    benchmark.updateUIAfterRun();
            }
        } catch (e) {
            this._state = BenchmarkState.ERROR;
            console.log(`Error in runCode of grouped benchmark ${benchmark.name}: `, e);
            console.log(e.stack);
            throw e;
        } finally {
            this._state = BenchmarkState.FINALIZE;
        }

        this.endTime = performance.now();
        performance.measure(this.name, this.name);

        this.processResults();
        this._state = BenchmarkState.DONE;
    }

    processResults() {
        this.results = [];
        for (const benchmark of this.benchmarks)
            this.results = this.results.concat(benchmark.results);
    }

    subScores() {
        const results = {};

        for (const benchmark of this.benchmarks) {
            let scores = benchmark.subScores();
            for (let subScore in scores) {
                results[subScore] ??= [];
                results[subScore].push(scores[subScore]);
            }
        }

        for (let subScore in results)
            results[subScore] = geomeanScore(results[subScore]);
        return results;
    }

    subTimes() {
        const results = {};

        for (const benchmark of this.benchmarks) {
            let times = benchmark.subTimes();
            for (let subTime in times) {
                results[subTime] ??= [];
                results[subTime].push(times[subTime]);
            }
        }

        for (let subTimes in results)
            results[subTimes] = sum(results[subTimes]);
        return results;
    }
};

class DefaultBenchmark extends Benchmark {
    constructor({worstCaseCount, ...args}) {
        super(args);

        this.worstCaseCount = this._processWorstCaseCount(worstCaseCount);
        this.firstIterationTime = null;
        this.firstIterationScore = null;
        this.worstTime = null;
        this.worstScore = null;
        this.averageTime = null;
        this.averageScore = null;
        if (this.worstCaseCount)
            console.assert(this.iterations > this.worstCaseCount);
        console.assert(this.worstCaseCount >= 0);
    }

    processResults(results) {
        results = super.processResults(results)

        this.firstIterationTime = results[0];
        this.firstIterationScore = toScore(results[0]);

        results = results.slice(1);
        results.sort((a, b) => a < b ? 1 : -1);
        for (let i = 0; i + 1 < results.length; ++i)
            console.assert(results[i] >= results[i + 1]);

        if (this.worstCaseCount) {
            const worstCase = [];
            for (let i = 0; i < this.worstCaseCount; ++i)
                worstCase.push(results[i]);
            this.worstTime = mean(worstCase);
            this.worstScore = toScore(this.worstTime);
        }
        this.averageTime = mean(results);
        this.averageScore = toScore(this.averageTime);
    }

    subScores() {
        const scores = { "First": this.firstIterationScore }
        if (this.worstCaseCount)
            scores["Worst"] = this.worstScore;
        if (this.iterations > 1)
            scores["Average"] = this.averageScore;
        return scores;
    }

    subTimes() {
        const times = {
            "First": this.firstIterationTime,
        };
        if (this.worstCaseCount)
            times["Worst"] = this.worstTime;
        if (this.iterations > 1)
            times["Average"] = this.averageTime;
        return times;
    }
}

class AsyncBenchmark extends DefaultBenchmark {
    get prerunCode() {
        let str = "";
        // FIXME: It would be nice if these were available to any benchmark not just async ones but since these functions
        // are async they would only work in a context where the benchmark is async anyway. Long term, we should do away
        // with this class and make all benchmarks async.
        if (isInBrowser) {
            str += `
                JetStream.getBinary = async function(blobURL) {
                    const response = await fetch(blobURL);
                    return new Int8Array(await response.arrayBuffer());
                };

                JetStream.getString = async function(blobURL) {
                    const response = await fetch(blobURL);
                    return response.text();
                };

                JetStream.dynamicImport = async function(blobURL) {
                    return await import(blobURL);
                };
            `;
        } else {
            str += `
                JetStream.getBinary = async function(path) {
                    if ("ShellPrefetchedResources" in globalThis) {
                        return ShellPrefetchedResources[path];
                    }
                    return new Int8Array(read(path, "binary"));
                };

                JetStream.getString = async function(path) {
                    if ("ShellPrefetchedResources" in globalThis) {
                        return new ShellTextDecoder().decode(ShellPrefetchedResources[path]);
                    }
                    return read(path);
                };

                JetStream.dynamicImport = async function(path) {
                    try {
                        // TODO: this skips the prefetched resources, but I'm
                        // not sure of a way around that.
                        return await import(path);
                    } catch (e) {
                        // In shells, relative imports require different paths, so try with and
                        // without the "./" prefix (e.g., JSC requires it).
                        return await import(path.slice("./".length))
                    }
                };
            `;
        }
        return str;
    }

    get prepareForNextIterationCode() {
        return "await benchmark.prepareForNextIteration?.();"
    }

    get runnerCode() {
        return `
        async function doRun() {
            const benchmark = new Benchmark(${JSON.stringify(this.benchmarkArguments)});
            await benchmark.init?.();
            const results = [];
            const benchmarkName = "${this.name}";

            for (let i = 0; i < ${this.iterations}; i++) {
                ${this.preIterationCode}

                const iterationMarkLabel = benchmarkName + "-iteration-" + i;
                const iterationStartMark = performance.mark(iterationMarkLabel);

                const start = performance.now();
                await benchmark.runIteration(i);
                const end = performance.now();

                performance.measure(iterationMarkLabel, iterationMarkLabel);

                ${this.postIterationCode}

                results.push(Math.max(1, end - start));
            }
            benchmark.validate?.(${this.iterations});
            top.currentResolve(results);
        };
        doRun().catch((error) => { top.currentReject(error); });`
    }
};

// Meant for wasm benchmarks that are directly compiled with an emcc build script. It might not work for benchmarks built as
// part of a larger project's build system or a wasm benchmark compiled from a language that doesn't compile with emcc.
class WasmEMCCBenchmark extends AsyncBenchmark {
    get prerunCode() {
        let str = `
            let verbose = false;

            let globalObject = this;

            abort = quit = function() {
                if (verbose)
                    console.log('Intercepted quit/abort');
            };

            const oldPrint = globalObject.print;
            globalObject.print = globalObject.printErr = (...args) => {
                if (verbose)
                    console.log('Intercepted print: ', ...args);
            };

            let Module = {
                preRun: [],
                postRun: [],
                noInitialRun: true,
                print: print,
                printErr: printErr
            };

            globalObject.Module = Module;
            ${super.prerunCode};
        `;

        return str;
    }
};

class WSLBenchmark extends Benchmark {
    constructor(plan) {
        super(plan);

        this.stdlibTime = null;
        this.stdlibScore = null;
        this.mainRunTime = null;
        this.mainRunScore = null;
    }

    processResults(results) {
        results = super.processResults(results);
        this.stdlibTime = results[0];
        this.stdlibScore = toScore(results[0]);
        this.mainRunTime = results[1];
        this.mainRunScore = toScore(results[1]);
    }

    get runnerCode() {
        return `{
            const benchmark = new Benchmark(${JSON.stringify(this.benchmarkArguments)});
            const benchmarkName = "${this.name}";

            const results = [];
            {
                const markLabel = benchmarkName + "-stdlib";
                const startMark = performance.mark(markLabel);

                const start = performance.now();
                benchmark.buildStdlib();
                results.push(performance.now() - start);

                performance.measure(markLabel, markLabel);
            }

            {
                const markLabel = benchmarkName + "-mainRun";
                const startMark = performance.mark(markLabel);

                const start = performance.now();
                benchmark.run();
                results.push(performance.now() - start);

                performance.measure(markLabel, markLabel);
            }
            top.currentResolve(results);
        }`;
    }

    subTimes() {
        return {
            "Stdlib": this.stdlibTime,
            "MainRun": this.mainRunTime,
        };
    }

    subScores() {
        return {
            "Stdlib": this.stdlibScore,
            "MainRun": this.mainRunScore,
        };
    }
};

class AsyncWasmLegacyBenchmark extends Benchmark {
    constructor(plan) {
        super(plan);
        this.startupTime = null;
        this.startupScore = null;
        this.runTime = null;
        this.runScore = null;
    }

    processResults(results) {
        results = super.processResults(results);
        this.startupTime = results[0];
        this.startupScore= toScore(results[0]);
        this.runTime = results[1];
        this.runScore = toScore(results[1]);
    }

    get prerunCode() {
        const str = `
            let verbose = false;

            let compileTime = null;
            let runTime = null;

            let globalObject = this;

            globalObject.benchmarkTime = performance.now.bind(performance);

            globalObject.reportCompileTime = (t) => {
                if (compileTime !== null)
                    throw new Error("called report compile time twice");
                compileTime = t;
            };

            globalObject.reportRunTime = (t) => {
                if (runTime !== null)
                    throw new Error("called report run time twice")
                runTime = t;
                top.currentResolve([compileTime, runTime]);
            };

            abort = quit = function() {
                if (verbose)
                    console.log('Intercepted quit/abort');
            };

            const oldConsoleLog = globalObject.console.log;
            globalObject.print = globalObject.printErr = (...args) => {
                if (verbose)
                    oldConsoleLog('Intercepted print: ', ...args);
            };

            let Module = {
                preRun: [],
                postRun: [],
                print: globalObject.print,
                printErr: globalObject.print
            };
            globalObject.Module = Module;
        `;
        return str;
    }

    get runnerCode() {
        let str = `JetStream.loadBlob = function(key, path, andThen) {`;

        if (isInBrowser) {
            str += `
                const xhr = new XMLHttpRequest();
                xhr.open('GET', path, true);
                xhr.responseType = 'arraybuffer';
                xhr.onload = function() {
                    Module[key] = new Int8Array(xhr.response);
                    andThen();
                };
                xhr.send(null);
            `;
        } else {
            str += `
            if (ShellPrefetchedResources) {
                Module[key] = ShellPrefetchedResources[path];
            } else {
                Module[key] = new Int8Array(read(path, "binary"));
            }
            if (andThen == doRun) {
                globalObject.read = (...args) => {
                    console.log("should not be inside read: ", ...args);
                    throw new Error;
                };
            };

            Promise.resolve(42).then(() => {
                try {
                    andThen();
                } catch(e) {
                    console.log("error running wasm:", e);
                    console.log(e.stack);
                    throw e;
                }
            });
            `;
        }

        str += "};\n";
        let preloadCount = 0;
        for (const [name, resource] of this.preloadEntries) {
            preloadCount++;
            str += `JetStream.loadBlob(${JSON.stringify(name)}, "${resource}", () => {\n`;
        }
        str += `doRun().catch((e) => {
            console.log("error running wasm:", e);
            console.log(e.stack)
            throw e;
        });`;
        for (let i = 0; i < preloadCount; ++i) {
            str += `})`;
        }
        str += `;`;

        return str;
    }

    subScores() {
        return {
            "Startup": this.startupScore,
            "Runtime": this.runScore,
        };
    }

    subTimes() {
        return {
            "Startup": this.startupTime,
            "Runtime": this.runTime,
        };
    }
};

function dotnetPreloads(type)
{
    return {
        dotnetUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/dotnet.js`,
        dotnetNativeUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/dotnet.native.js`,
        dotnetRuntimeUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/dotnet.runtime.js`,
        wasmBinaryUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/dotnet.native.wasm`,
        icuCustomUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/icudt_CJK.dat`,
        dllCollectionsConcurrentUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Collections.Concurrent.wasm`,
        dllCollectionsUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Collections.wasm`,
        dllComponentModelPrimitivesUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.ComponentModel.Primitives.wasm`,
        dllComponentModelTypeConverterUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.ComponentModel.TypeConverter.wasm`,
        dllDrawingPrimitivesUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Drawing.Primitives.wasm`,
        dllDrawingUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Drawing.wasm`,
        dllIOPipelinesUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.IO.Pipelines.wasm`,
        dllLinqUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Linq.wasm`,
        dllMemoryUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Memory.wasm`,
        dllObjectModelUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.ObjectModel.wasm`,
        dllPrivateCorelibUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Private.CoreLib.wasm`,
        dllRuntimeInteropServicesJavaScriptUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Runtime.InteropServices.JavaScript.wasm`,
        dllTextEncodingsWebUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Text.Encodings.Web.wasm`,
        dllTextJsonUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/System.Text.Json.wasm`,
        dllAppUrl: `./workloads/dotnet/build-${type}/wwwroot/_framework/dotnet.wasm`,
    }
}

let BENCHMARKS = [
    // ARES
    new DefaultBenchmark({
        name: "Air",
        files: [
            "./workloads/ARES-6/Air/symbols.js",
            "./workloads/ARES-6/Air/tmp_base.js",
            "./workloads/ARES-6/Air/arg.js",
            "./workloads/ARES-6/Air/basic_block.js",
            "./workloads/ARES-6/Air/code.js",
            "./workloads/ARES-6/Air/frequented_block.js",
            "./workloads/ARES-6/Air/inst.js",
            "./workloads/ARES-6/Air/opcode.js",
            "./workloads/ARES-6/Air/reg.js",
            "./workloads/ARES-6/Air/stack_slot.js",
            "./workloads/ARES-6/Air/tmp.js",
            "./workloads/ARES-6/Air/util.js",
            "./workloads/ARES-6/Air/custom.js",
            "./workloads/ARES-6/Air/liveness.js",
            "./workloads/ARES-6/Air/insertion_set.js",
            "./workloads/ARES-6/Air/allocate_stack.js",
            "./workloads/ARES-6/Air/payload-gbemu-executeIteration.js",
            "./workloads/ARES-6/Air/payload-imaging-gaussian-blur-gaussianBlur.js",
            "./workloads/ARES-6/Air/payload-airjs-ACLj8C.js",
            "./workloads/ARES-6/Air/payload-typescript-scanIdentifier.js",
            "./workloads/ARES-6/Air/benchmark.js",
        ],
        tags: ["default", "js", "ARES"],
    }),
    new DefaultBenchmark({
        name: "Basic",
        files: [
            "./workloads/ARES-6/Basic/ast.js",
            "./workloads/ARES-6/Basic/basic.js",
            "./workloads/ARES-6/Basic/caseless_map.js",
            "./workloads/ARES-6/Basic/lexer.js",
            "./workloads/ARES-6/Basic/number.js",
            "./workloads/ARES-6/Basic/parser.js",
            "./workloads/ARES-6/Basic/random.js",
            "./workloads/ARES-6/Basic/state.js",
            "./workloads/ARES-6/Basic/benchmark.js",
        ],
        tags: ["default", "js",  "ARES"],
    }),
    new DefaultBenchmark({
        name: "ML",
        files: [
            "./workloads/ARES-6/ML/index.js",
            "./workloads/ARES-6/ML/benchmark.js",
        ],
        iterations: 60,
        tags: ["default", "js",  "ARES"],
    }),
    new AsyncBenchmark({
        name: "Babylon",
        files: [
            "./workloads/ARES-6/Babylon/index.js",
            "./workloads/ARES-6/Babylon/benchmark.js",
        ],
        preload: {
            airBlob: "./workloads/ARES-6/Babylon/air-blob.js",
            basicBlob: "./workloads/ARES-6/Babylon/basic-blob.js",
            inspectorBlob: "./workloads/ARES-6/Babylon/inspector-blob.js",
            babylonBlob: "./workloads/ARES-6/Babylon/babylon-blob.js",
        },
        tags: ["default", "js",  "ARES"],
        allowUtf16: true,
    }),
    // CDJS
    new DefaultBenchmark({
        name: "cdjs",
        files: [
            "./workloads/cdjs/constants.js",
            "./workloads/cdjs/util.js",
            "./workloads/cdjs/red_black_tree.js",
            "./workloads/cdjs/call_sign.js",
            "./workloads/cdjs/vector_2d.js",
            "./workloads/cdjs/vector_3d.js",
            "./workloads/cdjs/motion.js",
            "./workloads/cdjs/reduce_collision_set.js",
            "./workloads/cdjs/simulator.js",
            "./workloads/cdjs/collision.js",
            "./workloads/cdjs/collision_detector.js",
            "./workloads/cdjs/benchmark.js",
        ],
        iterations: 60,
        worstCaseCount: 3,
        tags: ["default", "js",  ],
    }),
    // CodeLoad
    new AsyncBenchmark({
        name: "first-inspector-code-load",
        files: [
            "./workloads/code-load/code-first-load.js",
        ],
        preload: {
            inspectorPayloadBlob: "./workloads/code-load/inspector-payload-minified.js",
        },
        tags: ["default", "js", "inspector", "codeload"],
    }),
    new AsyncBenchmark({
        name: "multi-inspector-code-load",
        files: [
            "./workloads/code-load/code-multi-load.js",
        ],
        preload: {
            inspectorPayloadBlob: "./workloads/code-load/inspector-payload-minified.js",
        },
        tags: ["default", "js", "inspector", "codeload"],
    }),
    // Octane
    new DefaultBenchmark({
        name: "Box2D",
        files: [
            "./workloads/Octane/box2d.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "octane-code-load",
        files: [
            "./workloads/Octane/code-first-load.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js", "codeload", "Octane"],
    }),
    new DefaultBenchmark({
        name: "crypto",
        files: [
            "./workloads/Octane/crypto.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "delta-blue",
        files: [
            "./workloads/Octane/deltablue.js"
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "earley-boyer",
        files: [
            "./workloads/Octane/earley-boyer.js"
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "gbemu",
        files: [
            "./workloads/Octane/gbemu-part1.js",
            "./workloads/Octane/gbemu-part2.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "mandreel",
        files: [
            "./workloads/Octane/mandreel.js"
        ],
        iterations: 80,
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "navier-stokes",
        files: [
            "./workloads/Octane/navier-stokes.js",
        ],
        deterministicRandom: true,
        tags: ["default",  "js", "Octane"],
    }),
    new DefaultBenchmark({
        name: "pdfjs",
        files: [
            "./workloads/Octane/pdfjs.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "raytrace",
        files: [
            "./workloads/Octane/raytrace.js",
        ],
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "regexp-octane",
        files: [
            "./workloads/Octane/regexp.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js", "regexp", "Octane"],
    }),
    new DefaultBenchmark({
        name: "richards",
        files: [
            "./workloads/Octane/richards.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "splay",
        files: [
            "./workloads/Octane/splay.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js",  "Octane"],
    }),
    new DefaultBenchmark({
        name: "typescript-octane",
        files: [
            "./workloads/Octane/typescript-compiler.js",
            "./workloads/Octane/typescript-input.js",
            "./workloads/Octane/typescript.js",
        ],
        iterations: 15,
        worstCaseCount: 2,
        deterministicRandom: true,
        tags: ["Octane", "js",  "typescript"],
    }),
    // RexBench
    new DefaultBenchmark({
        name: "FlightPlanner",
        files: [
            "./workloads/RexBench/FlightPlanner/airways.js",
            "./workloads/RexBench/FlightPlanner/waypoints.js.z",
            "./workloads/RexBench/FlightPlanner/flight_planner.js",
            "./workloads/RexBench/FlightPlanner/expectations.js",
            "./workloads/RexBench/FlightPlanner/benchmark.js",
        ],
        tags: ["default", "js",  "RexBench"],
    }),
    new DefaultBenchmark({
        name: "OfflineAssembler",
        files: [
            "./workloads/RexBench/OfflineAssembler/registers.js",
            "./workloads/RexBench/OfflineAssembler/instructions.js",
            "./workloads/RexBench/OfflineAssembler/ast.js",
            "./workloads/RexBench/OfflineAssembler/parser.js",
            "./workloads/RexBench/OfflineAssembler/file.js",
            "./workloads/RexBench/OfflineAssembler/LowLevelInterpreter.js",
            "./workloads/RexBench/OfflineAssembler/LowLevelInterpreter32_64.js",
            "./workloads/RexBench/OfflineAssembler/LowLevelInterpreter64.js",
            "./workloads/RexBench/OfflineAssembler/InitBytecodes.js",
            "./workloads/RexBench/OfflineAssembler/expected.js",
            "./workloads/RexBench/OfflineAssembler/benchmark.js",
        ],
        iterations: 80,
        tags: ["default", "js",  "RexBench"],
    }),
    new DefaultBenchmark({
        name: "UniPoker",
        files: [
            "./workloads/RexBench/UniPoker/poker.js",
            "./workloads/RexBench/UniPoker/expected.js",
            "./workloads/RexBench/UniPoker/benchmark.js",
        ],
        deterministicRandom: true,
        // FIXME: UniPoker should not access isInBrowser.
        exposeBrowserTest: true,
        tags: ["default", "js",  "RexBench"],
    }),
    new DefaultBenchmark({
        name: "validatorjs",
        files: [
            // Use the unminified version for easier local profiling.
            // "./workloads/validatorjs/dist/bundle.es6.js",
            "./workloads/validatorjs/dist/bundle.es6.min.js",
            "./workloads/validatorjs/benchmark.js",
        ],
        tags: ["default", "js",  "regexp"],
    }),
    // Simple
    new DefaultBenchmark({
        name: "hash-map",
        files: [
            "./workloads/hash-map/hash-map.js",
        ],
        tags: ["default", "js",  "Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-promise",
        files: [
            "./workloads/doxbee-promise/doxbee-promise.js",
        ],
        tags: ["default",  "js", "promise", "Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-async",
        files: [
            "./workloads/doxbee-async/doxbee-async.js",
        ],
        tags: ["default", "js", "Simple"],
    }),
    // SeaMonster
    new DefaultBenchmark({
        name: "ai-astar",
        files: [
            "./workloads/SeaMonster/ai-astar.js"
        ],
        tags: ["default", "js", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "gaussian-blur",
        files: [
            "./workloads/SeaMonster/gaussian-blur.js",
        ],
        tags: ["default", "js", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-aes",
        files: [
            "./workloads/SeaMonster/sjlc.js",
            "./workloads/SeaMonster/stanford-crypto-aes.js",
        ],
        tags: ["default", "js", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-pbkdf2",
        files: [
            "./workloads/SeaMonster/sjlc.js",
            "./workloads/SeaMonster/stanford-crypto-pbkdf2.js"
        ],
        tags: ["default", "js", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-sha256",
        files: [
            "./workloads/SeaMonster/sjlc.js",
            "./workloads/SeaMonster/stanford-crypto-sha256.js",
        ],
        tags: ["default", "js", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-stringify-inspector",
        files: [
            "./workloads/SeaMonster/inspector-json-payload.js.z",
            "./workloads/SeaMonster/json-stringify-inspector.js",
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["default", "js", "json", "inspector", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-parse-inspector",
        files: [
            "./workloads/SeaMonster/inspector-json-payload.js.z",
            "./workloads/SeaMonster/json-parse-inspector.js",
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["default", "js", "json", "inspector", "SeaMonster"],
    }),
    // BigInt
    new AsyncBenchmark({
        name: "bigint-noble-bls12-381",
        files: [
            "./workloads/bigint/web-crypto-sham.js",
            "./workloads/bigint/noble-bls12-381-bundle.js",
            "./workloads/bigint/noble-benchmark.js",
        ],
        iterations: 4,
        worstCaseCount: 1,
        deterministicRandom: true,
        tags: ["js", "bigint", "BigIntNoble"],
    }),
    new AsyncBenchmark({
        name: "bigint-noble-secp256k1",
        files: [
            "./workloads/bigint/web-crypto-sham.js",
            "./workloads/bigint/noble-secp256k1-bundle.js",
            "./workloads/bigint/noble-benchmark.js",
        ],
        deterministicRandom: true,
        tags: ["js", "bigint", "BigIntNoble"],
    }),
    new AsyncBenchmark({
        name: "bigint-noble-ed25519",
        files: [
            "./workloads/bigint/web-crypto-sham.js",
            "./workloads/bigint/noble-ed25519-bundle.js",
            "./workloads/bigint/noble-benchmark.js",
        ],
        iterations: 30,
        deterministicRandom: true,
        tags: ["default", "js", "bigint", "BigIntNoble"],
    }),
    new DefaultBenchmark({
        name: "bigint-paillier",
        files: [
            "./workloads/bigint/web-crypto-sham.js",
            "./workloads/bigint/paillier-bundle.js",
            "./workloads/bigint/paillier-benchmark.js",
        ],
        iterations: 10,
        worstCaseCount: 2,
        deterministicRandom: true,
        tags: ["js", "bigint", "BigIntMisc"],
    }),
    new DefaultBenchmark({
        name: "bigint-bigdenary",
        files: [
            "./workloads/bigint/bigdenary-bundle.js",
            "./workloads/bigint/bigdenary-benchmark.js",
        ],
        iterations: 160,
        worstCaseCount: 16,
        tags: ["js", "bigint", "BigIntMisc"],
    }),
    // Proxy
    new AsyncBenchmark({
        name: "proxy-mobx",
        files: [
            "./workloads/proxy/common.js",
            "./workloads/proxy/mobx-bundle.js",
            "./workloads/proxy/mobx-benchmark.js",
        ],
        iterations: defaultIterationCount * 3,
        worstCaseCount: defaultWorstCaseCount * 3,
        tags: ["default", "js", "Proxy"],
    }),
    new AsyncBenchmark({
        name: "proxy-vue",
        files: [
            "./workloads/proxy/common.js",
            "./workloads/proxy/vue-bundle.js",
            "./workloads/proxy/vue-benchmark.js",
        ],
        tags: ["default", "js", "Proxy"],
    }),
    new AsyncBenchmark({
        name: "mobx-startup",
        files: [
            "./utils/StartupBenchmark.js",
            "./workloads/mobx-startup/benchmark.js",
        ],
        preload: {
            // Debug Sources for nicer profiling.
            // BUNDLE: "./workloads/mobx-startup/dist/bundle.es6.js",
            BUNDLE: "./workloads/mobx-startup/dist/bundle.es6.min.js",
        },
        tags: ["default", "js", "mobx", "startup", "es6"],
        iterations: 30,
        worstCaseCount: 3,
    }),
    new AsyncBenchmark({
        name: "jsdom-d3-startup",
        files: [
            "./utils/StartupBenchmark.js",
            "./workloads/jsdom-d3-startup/benchmark.js",
        ],
        preload: {
            // Unminified sources for profiling.
            // BUNDLE: "./workloads/jsdom-d3-startup/dist/bundle.js",
            BUNDLE: "./workloads/jsdom-d3-startup/dist/bundle.min.js",
            US_DATA: "./workloads/jsdom-d3-startup/data/counties-albers-10m.json",
            AIRPORTS: "./workloads/jsdom-d3-startup/data/airports.csv",
        },
        tags: ["default", "js", "d3", "startup", "jsdom"],
        iterations: 15,
        worstCaseCount: 2,
    }),
    new AsyncBenchmark({
        name: "web-ssr",
        files: [
            "./utils/StartupBenchmark.js",
            "./workloads/web-ssr/benchmark.js",
        ],
        preload: {
            // Debug Sources for nicer profiling.
            // BUNDLE: "./workloads/web-ssr/dist/bundle.js",
            BUNDLE: "./workloads/web-ssr/dist/bundle.min.js",
        },
        tags: ["default", "js", "web", "ssr"],
        iterations: 30,
    }),
    // Class fields
    new DefaultBenchmark({
        name: "raytrace-public-class-fields",
        files: [
            "./workloads/raytrace-public-class-fields/raytrace-public-class-fields.js",
        ],
        tags: ["default", "js", "ClassFields"],
    }),
    new DefaultBenchmark({
        name: "raytrace-private-class-fields",
        files: [
            "./workloads/raytrace-private-class-fields/raytrace-private-class-fields.js",
        ],
        tags: ["default", "js", "ClassFields"],
    }),
    new AsyncBenchmark({
        name: "typescript-lib",
        files: [
            "./workloads/typescript-lib/src/mock/sys.js",
            "./workloads/typescript-lib/dist/bundle.js",
            "./workloads/typescript-lib/benchmark.js",
        ],
        preload: {
            // Large test project:
            // "tsconfig": "./workloads/typescript-lib/src/gen/zod-medium/tsconfig.json",
            // "files": "./workloads/typescript-lib/src/gen/zod-medium/files.json",
            "tsconfig": "./workloads/typescript-lib/src/gen/immer-tiny/tsconfig.json",
            "files": "./workloads/typescript-lib/src/gen/immer-tiny/files.json",
        },
        iterations: 1,
        worstCaseCount: 0,
        tags: ["default", "js", "typescript"],
    }),
    // Generators
    new AsyncBenchmark({
        name: "async-fs",
        files: [
            "./workloads/async-fs/async-file-system.js",
        ],
        iterations: 80,
        worstCaseCount: 6,
        deterministicRandom: true,
        tags: ["default", "js", "Generators"],
    }),
    new DefaultBenchmark({
        name: "sync-fs",
        files: [
            "./workloads/sync-fs/sync-file-system.js",
        ],
        iterations: 80,
        worstCaseCount: 6,
        deterministicRandom: true,
        tags: ["default", "js", "Generators"],
    }),
    new DefaultBenchmark({
        name: "lazy-collections",
        files: [
            "./workloads/lazy-collections/lazy-collections.js",
        ],
        tags: ["default", "js", "Generators"],
    }),
    new DefaultBenchmark({
        name: "js-tokens",
        files: [
            "./workloads/js-tokens/js-tokens.js",
        ],
        tags: ["default", "js", "Generators"],
    }),
    new DefaultBenchmark({
        name: "threejs",
        files: [
            "./workloads/threejs/three.js",
            "./workloads/threejs/benchmark.js",
        ],
        deterministicRandom: true,
        tags: ["default", "js"],
    }),
    // Wasm
    new WasmEMCCBenchmark({
        name: "HashSet-wasm",
        files: [
            "./workloads/HashSet-wasm/build/HashSet.js",
            "./workloads/HashSet-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/HashSet-wasm/build/HashSet.wasm",
        },
        iterations: 50,
        // No longer run by-default: We have more realistic Wasm workloads by
        // now, and it was over-incentivizing inlining.
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "quicksort-wasm",
        files: [
            "./workloads/quicksort-wasm/build/quicksort.js",
            "./workloads/quicksort-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/quicksort-wasm/build/quicksort.wasm",
        },
        iterations: 50,
        // No longer run by-default: We have more realistic Wasm workloads by
        // now, and it was a small microbenchmark.
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "gcc-loops-wasm",
        files: [
            "./workloads/gcc-loops-wasm/build/gcc-loops.js",
            "./workloads/gcc-loops-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/gcc-loops-wasm/build/gcc-loops.wasm",
        },
        iterations: 50,
        // No longer run by-default: We have more realistic Wasm workloads by
        // now, and it was a small microbenchmark.
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "tsf-wasm",
        files: [
            "./workloads/tsf-wasm/build/tsf.js",
            "./workloads/tsf-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/tsf-wasm/build/tsf.wasm",
        },
        iterations: 50,
        tags: ["default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "richards-wasm",
        files: [
            "./workloads/richards-wasm/build/richards.js",
            "./workloads/richards-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/richards-wasm/build/richards.wasm",
        },
        iterations: 50,
        tags: ["default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "sqlite3-wasm",
        files: [
            "./utils/polyfills/fast-text-encoding/1.0.3/text.js",
            "./workloads/sqlite3-wasm/benchmark.js",
            "./workloads/sqlite3-wasm/build/jswasm/speedtest1.js",
        ],
        preload: {
            wasmBinary: "./workloads/sqlite3-wasm/build/jswasm/speedtest1.wasm",
        },
        iterations: 30,
        worstCaseCount: 2,
        tags: ["default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Dart-flute-complex-wasm",
        files: [
            "./workloads/Dart/benchmark.js",
        ],
        preload: {
            jsModule: "./workloads/Dart/build/flute.complex.dart2wasm.mjs",
            wasmBinary: "./workloads/Dart/build/flute.complex.dart2wasm.wasm",
        },
        iterations: 15,
        worstCaseCount: 2,
        // Not run by default because the `CupertinoTimePicker` widget is very allocation-heavy,
        // leading to an unrealistic GC-dominated workload. See
        // https://github.com/WebKit/JetStream/pull/97#issuecomment-3139924169
        // The todomvc workload below is less allocation heavy and a replacement for now.
        // TODO: Revisit, once Dart/Flutter worked on this widget or workload.
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Dart-flute-todomvc-wasm",
        files: [
            "./workloads/Dart/benchmark.js",
        ],
        preload: {
            jsModule: "./workloads/Dart/build/flute.todomvc.dart2wasm.mjs",
            wasmBinary: "./workloads/Dart/build/flute.todomvc.dart2wasm.wasm",
        },
        iterations: 30,
        worstCaseCount: 2,
        tags: ["default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Kotlin-compose-wasm",
        files: [
            "./workloads/Kotlin-compose-wasm/benchmark.js",
        ],
        preload: {
            skikoJsModule: "./workloads/Kotlin-compose-wasm/build/skiko.mjs",
            skikoWasmBinary: "./workloads/Kotlin-compose-wasm/build/skiko.wasm",
            composeJsModule: "./workloads/Kotlin-compose-wasm/build/compose-benchmarks-benchmarks.uninstantiated.mjs",
            composeWasmBinary: "./workloads/Kotlin-compose-wasm/build/compose-benchmarks-benchmarks.wasm",
            inputImageCompose: "./workloads/Kotlin-compose-wasm/build/compose-multiplatform.png",
            inputImageCat: "./workloads/Kotlin-compose-wasm/build/example1_cat.jpg",
            inputImageComposeCommunity: "./workloads/Kotlin-compose-wasm/build/example1_compose-community-primary.png",
            inputFontItalic: "./workloads/Kotlin-compose-wasm/build/jetbrainsmono_italic.ttf",
            inputFontRegular: "./workloads/Kotlin-compose-wasm/build/jetbrainsmono_regular.ttf"
        },
        iterations: 5,
        worstCaseCount: 1,
        tags: ["default", "Wasm"],
    }),
    new AsyncBenchmark({
        name: "transformersjs-bert-wasm",
        files: [
            "./utils/polyfills/fast-text-encoding/1.0.3/text.js",
            "./workloads/transformersjs/benchmark.js",
            "./workloads/transformersjs/task-bert.js",
        ],
        preload: {
            transformersJsModule: "./workloads/transformersjs/build/transformers.js",
            
            onnxJsModule: "./workloads/transformersjs/build/onnxruntime-web/ort-wasm-simd-threaded.mjs",
            onnxWasmBinary: "./workloads/transformersjs/build/onnxruntime-web/ort-wasm-simd-threaded.wasm",

            modelWeights: "./workloads/transformersjs/build/models/Xenova/distilbert-base-uncased-finetuned-sst-2-english/onnx/model_uint8.onnx",
            modelConfig: "./workloads/transformersjs/build/models/Xenova/distilbert-base-uncased-finetuned-sst-2-english/config.json",
            modelTokenizer: "./workloads/transformersjs/build/models/Xenova/distilbert-base-uncased-finetuned-sst-2-english/tokenizer.json",
            modelTokenizerConfig: "./workloads/transformersjs/build/models/Xenova/distilbert-base-uncased-finetuned-sst-2-english/tokenizer_config.json",
        },
        iterations: 30,
        allowUtf16: true,
        tags: ["default", "Wasm", "transformersjs"],
    }),
    new AsyncBenchmark({
        name: "transformersjs-whisper-wasm",
        files: [
            "./utils/polyfills/fast-text-encoding/1.0.3/text.js",
            "./workloads/transformersjs/benchmark.js",
            "./workloads/transformersjs/task-whisper.js",
        ],
        preload: {
            transformersJsModule: "./workloads/transformersjs/build/transformers.js",
            
            onnxJsModule: "./workloads/transformersjs/build/onnxruntime-web/ort-wasm-simd-threaded.mjs",
            onnxWasmBinary: "./workloads/transformersjs/build/onnxruntime-web/ort-wasm-simd-threaded.wasm",

            modelEncoderWeights: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/onnx/encoder_model_quantized.onnx",
            modelDecoderWeights: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/onnx/decoder_model_merged_quantized.onnx",
            modelConfig: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/config.json",
            modelTokenizer: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/tokenizer.json",
            modelTokenizerConfig: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/tokenizer_config.json",
            modelPreprocessorConfig: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/preprocessor_config.json",
            modelGenerationConfig: "./workloads/transformersjs/build/models/Xenova/whisper-tiny.en/generation_config.json",

            inputFile: "./workloads/transformersjs/build/inputs/jfk.raw",
        },
        iterations: 5,
        worstCaseCount: 1,
        allowUtf16: true,
        tags: ["Wasm", "transformersjs"],
    }),
    new AsyncWasmLegacyBenchmark({
        name: "tfjs-wasm",
        files: [
            "./workloads/tfjs-wasm/tfjs-model-helpers.js",
            "./workloads/tfjs-wasm/tfjs-model-mobilenet-v3.js",
            "./workloads/tfjs-wasm/tfjs-model-mobilenet-v1.js",
            "./workloads/tfjs-wasm/tfjs-model-coco-ssd.js",
            "./workloads/tfjs-wasm/tfjs-model-use.js",
            "./workloads/tfjs-wasm/tfjs-model-use-vocab.js",
            "./workloads/tfjs-wasm/tfjs-bundle.js",
            "./workloads/tfjs-wasm/tfjs.js",
            "./workloads/tfjs-wasm/tfjs-benchmark.js",
        ],
        preload: {
            tfjsBackendWasmBlob: "./workloads/tfjs-wasm/tfjs-backend-wasm.wasm",
        },
        deterministicRandom: true,
        exposeBrowserTest: true,
        allowUtf16: true,
        tags: ["Wasm"],
    }),
    new AsyncWasmLegacyBenchmark({
        name: "tfjs-wasm-simd",
        files: [
            "./workloads/tfjs-wasm/tfjs-model-helpers.js",
            "./workloads/tfjs-wasm/tfjs-model-mobilenet-v3.js",
            "./workloads/tfjs-wasm/tfjs-model-mobilenet-v1.js",
            "./workloads/tfjs-wasm/tfjs-model-coco-ssd.js",
            "./workloads/tfjs-wasm/tfjs-model-use.js",
            "./workloads/tfjs-wasm/tfjs-model-use-vocab.js",
            "./workloads/tfjs-wasm/tfjs-bundle.js",
            "./workloads/tfjs-wasm/tfjs.js",
            "./workloads/tfjs-wasm/tfjs-benchmark.js",
        ],
        preload: {
            tfjsBackendWasmSimdBlob: "./workloads/tfjs-wasm/tfjs-backend-wasm-simd.wasm",
        },
        deterministicRandom: true,
        exposeBrowserTest: true,
        allowUtf16: true,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "argon2-wasm",
        files: [
            "./workloads/argon2-wasm/build/argon2.js",
            "./workloads/argon2-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/argon2-wasm/build/argon2.wasm.z",
        },
        iterations: 30,
        worstCaseCount: 3,
        deterministicRandom: true,
        allowUtf16: true,
        tags: ["default", "Wasm"],
    }),
    new AsyncBenchmark({
        name: "babylonjs-startup-es5",
        files: [
            "./utils/StartupBenchmark.js",
            "./workloads/babylonjs/benchmark/startup.js",
        ],
        preload: {
            BUNDLE: "./workloads/babylonjs/dist/bundle.es5.min.js",
        },
        args: {
            expectedCacheCommentCount: 23988,
        },
        tags: ["startup",  "js", "class", "es5", "babylonjs"],
        iterations: 10,
    }),
    new AsyncBenchmark({
        name: "babylonjs-startup-es6",
        files: [
            "./utils/StartupBenchmark.js",
            "./workloads/babylonjs/benchmark/startup.js",
        ],
        preload: {
            BUNDLE: "./workloads/babylonjs/dist/bundle.es6.min.js",
        },
        args: {
            expectedCacheCommentCount: 21222,
        },
        tags: ["Default",  "js", "startup", "class", "es6", "babylonjs"],
        iterations: 10,
    }),
    new AsyncBenchmark({
        name: "babylonjs-scene-es5",
        files: [
            // Use non-minified sources for easier profiling:
            // "./workloads/babylonjs/dist/bundle.es5.js",
            "./workloads/babylonjs/dist/bundle.es5.min.js",
            "./workloads/babylonjs/benchmark/scene.js",
        ],
        preload: {
            PARTICLES_BLOB: "./workloads/babylonjs/data/particles.json",
            PIRATE_FORT_BLOB: "./workloads/babylonjs/data/pirateFort.glb",
            CANNON_BLOB: "./workloads/babylonjs/data/cannon.glb",
        },
        tags: ["scene", "js",  "es5", "babylonjs"],
        iterations: 5,
    }),
    new AsyncBenchmark({
        name: "babylonjs-scene-es6",
        files: [
            // Use non-minified sources for easier profiling:
            // "./workloads/babylonjs/dist/bundle.es6.js",
            "./workloads/babylonjs/dist/bundle.es6.min.js",
            "./workloads/babylonjs/benchmark/scene.js",
        ],
        preload: {
            PARTICLES_BLOB: "./workloads/babylonjs/data/particles.json",
            PIRATE_FORT_BLOB: "./workloads/babylonjs/data/pirateFort.glb",
            CANNON_BLOB: "./workloads/babylonjs/data/cannon.glb",
        },
        tags: ["Default", "js", "scene", "es6", "babylonjs"],
        iterations: 5,
    }),
    // WorkerTests
    new AsyncBenchmark({
        name: "bomb-workers",
        files: [
            "./workloads/bomb-workers/bomb.js",
        ],
        exposeBrowserTest: true,
        iterations: 80,
        preload: {
            rayTrace3D: "./workloads/bomb-workers/bomb-subtests/3d-raytrace.js",
            accessNbody: "./workloads/bomb-workers/bomb-subtests/access-nbody.js",
            morph3D: "./workloads/bomb-workers/bomb-subtests/3d-morph.js",
            cube3D: "./workloads/bomb-workers/bomb-subtests/3d-cube.js",
            accessFunnkuch: "./workloads/bomb-workers/bomb-subtests/access-fannkuch.js",
            accessBinaryTrees: "./workloads/bomb-workers/bomb-subtests/access-binary-trees.js",
            accessNsieve: "./workloads/bomb-workers/bomb-subtests/access-nsieve.js",
            bitopsBitwiseAnd: "./workloads/bomb-workers/bomb-subtests/bitops-bitwise-and.js",
            bitopsNsieveBits: "./workloads/bomb-workers/bomb-subtests/bitops-nsieve-bits.js",
            controlflowRecursive: "./workloads/bomb-workers/bomb-subtests/controlflow-recursive.js",
            bitops3BitBitsInByte: "./workloads/bomb-workers/bomb-subtests/bitops-3bit-bits-in-byte.js",
            botopsBitsInByte: "./workloads/bomb-workers/bomb-subtests/bitops-bits-in-byte.js",
            cryptoAES: "./workloads/bomb-workers/bomb-subtests/crypto-aes.js",
            cryptoMD5: "./workloads/bomb-workers/bomb-subtests/crypto-md5.js",
            cryptoSHA1: "./workloads/bomb-workers/bomb-subtests/crypto-sha1.js",
            dateFormatTofte: "./workloads/bomb-workers/bomb-subtests/date-format-tofte.js",
            dateFormatXparb: "./workloads/bomb-workers/bomb-subtests/date-format-xparb.js",
            mathCordic: "./workloads/bomb-workers/bomb-subtests/math-cordic.js",
            mathPartialSums: "./workloads/bomb-workers/bomb-subtests/math-partial-sums.js",
            mathSpectralNorm: "./workloads/bomb-workers/bomb-subtests/math-spectral-norm.js",
            stringBase64: "./workloads/bomb-workers/bomb-subtests/string-base64.js",
            stringFasta: "./workloads/bomb-workers/bomb-subtests/string-fasta.js",
            stringValidateInput: "./workloads/bomb-workers/bomb-subtests/string-validate-input.js",
            stringTagcloud: "./workloads/bomb-workers/bomb-subtests/string-tagcloud.js",
            stringUnpackCode: "./workloads/bomb-workers/bomb-subtests/string-unpack-code.js",
            regexpDNA: "./workloads/bomb-workers/bomb-subtests/regexp-dna.js",
        },
        tags: ["default", "js", "WorkerTests"],
    }),
    new AsyncBenchmark({
        name: "segmentation",
        files: [
            "./workloads/segmentation/segmentation.js",
        ],
        preload: {
            asyncTaskBlob: "./workloads/segmentation/async-task.js",
        },
        iterations: 36,
        worstCaseCount: 3,
        tags: ["default", "js",  "WorkerTests"],
    }),
    // WSL
    new WSLBenchmark({
        name: "WSL",
        files: [
            "./workloads/WSL/Node.js",
            "./workloads/WSL/Type.js",
            "./workloads/WSL/ReferenceType.js",
            "./workloads/WSL/Value.js",
            "./workloads/WSL/Expression.js",
            "./workloads/WSL/Rewriter.js",
            "./workloads/WSL/Visitor.js",
            "./workloads/WSL/CreateLiteral.js",
            "./workloads/WSL/CreateLiteralType.js",
            "./workloads/WSL/PropertyAccessExpression.js",
            "./workloads/WSL/AddressSpace.js",
            "./workloads/WSL/AnonymousVariable.js",
            "./workloads/WSL/ArrayRefType.js",
            "./workloads/WSL/ArrayType.js",
            "./workloads/WSL/Assignment.js",
            "./workloads/WSL/AutoWrapper.js",
            "./workloads/WSL/Block.js",
            "./workloads/WSL/BoolLiteral.js",
            "./workloads/WSL/Break.js",
            "./workloads/WSL/CallExpression.js",
            "./workloads/WSL/CallFunction.js",
            "./workloads/WSL/Check.js",
            "./workloads/WSL/CheckLiteralTypes.js",
            "./workloads/WSL/CheckLoops.js",
            "./workloads/WSL/CheckRecursiveTypes.js",
            "./workloads/WSL/CheckRecursion.js",
            "./workloads/WSL/CheckReturns.js",
            "./workloads/WSL/CheckUnreachableCode.js",
            "./workloads/WSL/CheckWrapped.js",
            "./workloads/WSL/Checker.js",
            "./workloads/WSL/CloneProgram.js",
            "./workloads/WSL/CommaExpression.js",
            "./workloads/WSL/ConstexprFolder.js",
            "./workloads/WSL/ConstexprTypeParameter.js",
            "./workloads/WSL/Continue.js",
            "./workloads/WSL/ConvertPtrToArrayRefExpression.js",
            "./workloads/WSL/DereferenceExpression.js",
            "./workloads/WSL/DoWhileLoop.js",
            "./workloads/WSL/DotExpression.js",
            "./workloads/WSL/DoubleLiteral.js",
            "./workloads/WSL/DoubleLiteralType.js",
            "./workloads/WSL/EArrayRef.js",
            "./workloads/WSL/EBuffer.js",
            "./workloads/WSL/EBufferBuilder.js",
            "./workloads/WSL/EPtr.js",
            "./workloads/WSL/EnumLiteral.js",
            "./workloads/WSL/EnumMember.js",
            "./workloads/WSL/EnumType.js",
            "./workloads/WSL/EvaluationCommon.js",
            "./workloads/WSL/Evaluator.js",
            "./workloads/WSL/ExpressionFinder.js",
            "./workloads/WSL/ExternalOrigin.js",
            "./workloads/WSL/Field.js",
            "./workloads/WSL/FindHighZombies.js",
            "./workloads/WSL/FlattenProtocolExtends.js",
            "./workloads/WSL/FlattenedStructOffsetGatherer.js",
            "./workloads/WSL/FloatLiteral.js",
            "./workloads/WSL/FloatLiteralType.js",
            "./workloads/WSL/FoldConstexprs.js",
            "./workloads/WSL/ForLoop.js",
            "./workloads/WSL/Func.js",
            "./workloads/WSL/FuncDef.js",
            "./workloads/WSL/FuncInstantiator.js",
            "./workloads/WSL/FuncParameter.js",
            "./workloads/WSL/FunctionLikeBlock.js",
            "./workloads/WSL/HighZombieFinder.js",
            "./workloads/WSL/IdentityExpression.js",
            "./workloads/WSL/IfStatement.js",
            "./workloads/WSL/IndexExpression.js",
            "./workloads/WSL/InferTypesForCall.js",
            "./workloads/WSL/Inline.js",
            "./workloads/WSL/Inliner.js",
            "./workloads/WSL/InstantiateImmediates.js",
            "./workloads/WSL/IntLiteral.js",
            "./workloads/WSL/IntLiteralType.js",
            "./workloads/WSL/Intrinsics.js",
            "./workloads/WSL/LateChecker.js",
            "./workloads/WSL/Lexer.js",
            "./workloads/WSL/LexerToken.js",
            "./workloads/WSL/LiteralTypeChecker.js",
            "./workloads/WSL/LogicalExpression.js",
            "./workloads/WSL/LogicalNot.js",
            "./workloads/WSL/LoopChecker.js",
            "./workloads/WSL/MakeArrayRefExpression.js",
            "./workloads/WSL/MakePtrExpression.js",
            "./workloads/WSL/NameContext.js",
            "./workloads/WSL/NameFinder.js",
            "./workloads/WSL/NameResolver.js",
            "./workloads/WSL/NativeFunc.js",
            "./workloads/WSL/NativeFuncInstance.js",
            "./workloads/WSL/NativeType.js",
            "./workloads/WSL/NativeTypeInstance.js",
            "./workloads/WSL/NormalUsePropertyResolver.js",
            "./workloads/WSL/NullLiteral.js",
            "./workloads/WSL/NullType.js",
            "./workloads/WSL/OriginKind.js",
            "./workloads/WSL/OverloadResolutionFailure.js",
            "./workloads/WSL/Parse.js",
            "./workloads/WSL/Prepare.js",
            "./workloads/WSL/Program.js",
            "./workloads/WSL/ProgramWithUnnecessaryThingsRemoved.js",
            "./workloads/WSL/PropertyResolver.js",
            "./workloads/WSL/Protocol.js",
            "./workloads/WSL/ProtocolDecl.js",
            "./workloads/WSL/ProtocolFuncDecl.js",
            "./workloads/WSL/ProtocolRef.js",
            "./workloads/WSL/PtrType.js",
            "./workloads/WSL/ReadModifyWriteExpression.js",
            "./workloads/WSL/RecursionChecker.js",
            "./workloads/WSL/RecursiveTypeChecker.js",
            "./workloads/WSL/ResolveNames.js",
            "./workloads/WSL/ResolveOverloadImpl.js",
            "./workloads/WSL/ResolveProperties.js",
            "./workloads/WSL/ResolveTypeDefs.js",
            "./workloads/WSL/Return.js",
            "./workloads/WSL/ReturnChecker.js",
            "./workloads/WSL/ReturnException.js",
            "./workloads/WSL/StandardLibrary.js",
            "./workloads/WSL/StatementCloner.js",
            "./workloads/WSL/StructLayoutBuilder.js",
            "./workloads/WSL/StructType.js",
            "./workloads/WSL/Substitution.js",
            "./workloads/WSL/SwitchCase.js",
            "./workloads/WSL/SwitchStatement.js",
            "./workloads/WSL/SynthesizeEnumFunctions.js",
            "./workloads/WSL/SynthesizeStructAccessors.js",
            "./workloads/WSL/TrapStatement.js",
            "./workloads/WSL/TypeDef.js",
            "./workloads/WSL/TypeDefResolver.js",
            "./workloads/WSL/TypeOrVariableRef.js",
            "./workloads/WSL/TypeParameterRewriter.js",
            "./workloads/WSL/TypeRef.js",
            "./workloads/WSL/TypeVariable.js",
            "./workloads/WSL/TypeVariableTracker.js",
            "./workloads/WSL/TypedValue.js",
            "./workloads/WSL/UintLiteral.js",
            "./workloads/WSL/UintLiteralType.js",
            "./workloads/WSL/UnificationContext.js",
            "./workloads/WSL/UnreachableCodeChecker.js",
            "./workloads/WSL/VariableDecl.js",
            "./workloads/WSL/VariableRef.js",
            "./workloads/WSL/VisitingSet.js",
            "./workloads/WSL/WSyntaxError.js",
            "./workloads/WSL/WTrapError.js",
            "./workloads/WSL/WTypeError.js",
            "./workloads/WSL/WhileLoop.js",
            "./workloads/WSL/WrapChecker.js",
            "./workloads/WSL/Test.js",
        ],
        tags: ["default", "js", "WSL"],
    }),
    // 8bitbench
    new WasmEMCCBenchmark({
        name: "8bitbench-wasm",
        files: [
            "./utils/polyfills/fast-text-encoding/1.0.3/text.js",
            "./workloads/8bitbench-wasm/build/rust/pkg/emu_bench.js",
            "./workloads/8bitbench-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/8bitbench-wasm/build/rust/pkg/emu_bench_bg.wasm",
            romBinary: "./workloads/8bitbench-wasm/build/assets/program.bin",
        },
        iterations: 15,
        worstCaseCount: 2,
        tags: ["default", "Wasm"],
    }),
    // zlib-wasm
    new WasmEMCCBenchmark({
        name: "zlib-wasm",
        files: [
            "./workloads/zlib-wasm/build/zlib.js",
            "./workloads/zlib-wasm/benchmark.js",
        ],
        preload: {
            wasmBinary: "./workloads/zlib-wasm/build/zlib.wasm",
        },
        iterations: 40,
        tags: ["default", "Wasm"],
    }),
    // .NET
    new AsyncBenchmark({
        name: "dotnet-interp-wasm",
        files: [
            "./workloads/dotnet/interp.js",
            "./workloads/dotnet/benchmark.js",
        ],
        preload: dotnetPreloads("interp"),
        iterations: 10,
        worstCaseCount: 2,
        tags: ["default", "Wasm", "dotnet"],
    }),
    new AsyncBenchmark({
        name: "dotnet-aot-wasm",
        files: [
            "./workloads/dotnet/aot.js",
            "./workloads/dotnet/benchmark.js",
        ],
        preload: dotnetPreloads("aot"),
        iterations: 15,
        worstCaseCount: 2,
        tags: ["default", "Wasm", "dotnet"],
    }),
    // J2CL
    new AsyncBenchmark({
        name: "j2cl-box2d-wasm",
        files: [
            "./workloads/j2cl-box2d-wasm/benchmark.js",
            "./workloads/j2cl-box2d-wasm/build/Box2dBenchmark_j2wasm_entry.js",
        ],
        preload: {
            wasmBinary: "./workloads/j2cl-box2d-wasm/build/Box2dBenchmark_j2wasm_binary.wasm",
        },
        iterations: 40,
        tags: ["default", "Wasm"],
    }),
];


const PRISM_JS_FILES = [
    "./utils/StartupBenchmark.js",
    "./workloads/prismjs/benchmark.js",
];
const PRISM_JS_PRELOADS = {
    SAMPLE_CPP: "./workloads/prismjs/data/sample.cpp",
    SAMPLE_CSS: "./workloads/prismjs/data/sample.css",
    SAMPLE_HTML: "./workloads/prismjs/data/sample.html",
    SAMPLE_JS: "./workloads/prismjs/data/sample.js",
    SAMPLE_JSON: "./workloads/prismjs/data/sample.json",
    SAMPLE_MD: "./workloads/prismjs/data/sample.md",
    SAMPLE_PY: "./workloads/prismjs/data/sample.py",
    SAMPLE_SQL: "./workloads/prismjs/data/sample.sql",
    SAMPLE_TS: "./workloads/prismjs/data/sample.ts",
};
const PRISM_JS_TAGS = ["js", "parser", "regexp", "startup", "prismjs"];
BENCHMARKS.push(
    new AsyncBenchmark({
        name: "prismjs-startup-es6",
        files: PRISM_JS_FILES,
        preload: {
            // Use non-minified bundle for better local profiling.
            // BUNDLE: "./workloads/prismjs/dist/bundle.es6.js",
            BUNDLE: "./workloads/prismjs/dist/bundle.es6.min.js",
            ...PRISM_JS_PRELOADS,
        },
        tags: ["default", ...PRISM_JS_TAGS, "es6"],
    }),
    new AsyncBenchmark({
        name: "prismjs-startup-es5",
        files: PRISM_JS_FILES,
        preload: {
            // Use non-minified bundle for better local profiling.
            // BUNDLE: "./workloads/prismjs/dist/bundle.es5.js",
            BUNDLE: "./workloads/prismjs/dist/bundle.es5.min.js",
            ...PRISM_JS_PRELOADS,
        },
        tags: [...PRISM_JS_TAGS, "es5"],
    }),
);

const INTL_TESTS = [
    "DateTimeFormat",
    "ListFormat",
    "RelativeTimeFormat",
    "NumberFormat",
    "PluralRules",
];
const INTL_TAGS = ["js", "internationalization"]
const INTL_BENCHMARKS = [];
for (const test of INTL_TESTS) {
    const benchmark = new AsyncBenchmark({
        name: `${test}-intl`,
        files: [
            "./workloads/intl/src/helper.js",
            `./workloads/intl/src/${test}.js`,
            "./workloads/intl/benchmark.js",
        ],
        iterations: 2,
        worstCaseCount: 1,
        deterministicRandom: true,
        tags: INTL_TAGS,
    });
    INTL_BENCHMARKS.push(benchmark);
}
BENCHMARKS.push(
    new GroupedBenchmark({
            name: "intl",
            tags: INTL_TAGS,
        }, INTL_BENCHMARKS));



// SunSpider tests
const SUNSPIDER_TESTS = [
    "3d-cube",
    "3d-raytrace",
    "base64",
    "crypto-aes",
    "crypto-md5",
    "crypto-sha1",
    "date-format-tofte",
    "date-format-xparb",
    "n-body",
    "regex-dna",
    "string-unpack-code",
    "tagcloud",
];
let SUNSPIDER_BENCHMARKS = [];
for (const test of SUNSPIDER_TESTS) {
    SUNSPIDER_BENCHMARKS.push(new DefaultBenchmark({
        name: `${test}-SP`,
        files: [
            `./workloads/SunSpider/${test}.js`
        ],
        tags: [],
    }));
}
BENCHMARKS.push(new GroupedBenchmark({
    name: "Sunspider",
    tags: ["default", "js", "SunSpider"],
}, SUNSPIDER_BENCHMARKS))

// WTB (Web Tooling Benchmark) tests
const WTB_TESTS = {
    "acorn": true,
    "babel": true,
    "babel-minify": true,
    "babylon": true,
    "chai": true,
    "espree": true,
    "esprima-next": true,
    // Disabled: Converting ES5 code to ES6+ is no longer a realistic scenario.
    "lebab": false, 
    "postcss": true,
    "prettier": true,
    "source-map": true,
};
const WPT_FILES = [
  "angular-material-20.1.6.css",
  "backbone-1.6.1.js",
  "bootstrap-5.3.7.css",
  "foundation-6.9.0.css",
  "jquery-3.7.1.js",
  "lodash.core-4.17.21.js",
  "lodash-4.17.4.min.js.map",
  "mootools-core-1.6.0.js",
  "preact-8.2.5.js",
  "preact-10.27.1.min.module.js.map",
  "redux-5.0.1.min.js",
  "redux-5.0.1.esm.js",
  "source-map.min-0.5.7.js.map",
  "source-map/lib/mappings.wasm",
  "speedometer-es2015-test-2.0.js",
  "todomvc/react/app.jsx",
  "todomvc/react/footer.jsx",
  "todomvc/react/todoItem.jsx",
  "todomvc/typescript-angular.ts",
  "underscore-1.13.7.js",
  "underscore-1.13.7.min.js.map",
  "vue-3.5.18.runtime.esm-browser.js",
].reduce((acc, file) => {
        acc[file] = `./workloads/web-tooling-benchmark/third_party/${file}`;
        return acc
}, Object.create(null));


for (const [name, enabled] of Object.entries(WTB_TESTS)) {
    const tags =  ["js", "WTB"];
    if (enabled)
        tags.push("Default");
    BENCHMARKS.push(new AsyncBenchmark({
        name: `${name}-wtb`,
        files: [
            `./workloads/web-tooling-benchmark/dist/${name}.bundle.js`,
            "./workloads/web-tooling-benchmark/benchmark.js",
        ],
        preload: {
            BUNDLE: `./workloads/web-tooling-benchmark/dist/${name}.bundle.js`,
            ...WPT_FILES,
        },
        iterations: 15,
        worstCaseCount: 2,
        allowUtf16: true,
        tags: tags,
    }));
}


const benchmarksByName = new Map();
const benchmarksByTag = new Map();

for (const benchmark of BENCHMARKS) {
    const name = benchmark.name.toLowerCase();

    if (benchmarksByName.has(name))
        throw new Error(`Duplicate benchmark with name "${name}}"`);
    else
        benchmarksByName.set(name, benchmark);

    for (const tag of benchmark.tags) {
        if (benchmarksByTag.has(tag))
            benchmarksByTag.get(tag).push(benchmark);
        else
            benchmarksByTag.set(tag, [benchmark]);
    }
}


function processTestList(testList) {
    let benchmarkNames = [];
    let benchmarks = [];

    if (testList instanceof Array)
        benchmarkNames = testList;
    else
        benchmarkNames = testList.split(/[\s,]/);

    for (let name of benchmarkNames) {
        name = name.toLowerCase();
        if (benchmarksByTag.has(name))
            benchmarks = benchmarks.concat(findBenchmarksByTag(name));
        else
            benchmarks.push(findBenchmarkByName(name));
    }
    return benchmarks;
}


function findBenchmarkByName(name) {
    const benchmark = benchmarksByName.get(name.toLowerCase());

    if (!benchmark)
        throw new Error(`Couldn't find benchmark named "${name}"`);

    return benchmark;
}


function findBenchmarksByTag(tag, excludeTags) {
    let benchmarks = benchmarksByTag.get(tag.toLowerCase());
    if (!benchmarks) {
        const validTags = Array.from(benchmarksByTag.keys()).join(", ");
        throw new Error(`Couldn't find tag named: ${tag}.\n Choices are ${validTags}`);
    }
    if (excludeTags) {
        benchmarks = benchmarks.filter(benchmark => {
            return !benchmark.hasAnyTag(...excludeTags);
        });
    }
    return benchmarks;
}


let benchmarks = [];
const defaultDisabledTags = [];
// FIXME: add better support to run Worker tests in shells.
if (!isInBrowser)
    defaultDisabledTags.push("WorkerTests");

if (JetStreamParams.testList.length) {
    benchmarks = processTestList(JetStreamParams.testList);
} else {
    benchmarks = findBenchmarksByTag("Default", defaultDisabledTags)
}

if (JetStreamParams.testExcludeList.length) {
    const excludeList = new Set(JetStreamParams.testExcludeList.map(name => name.toLowerCase()));
    benchmarks = benchmarks.filter(benchmark => !excludeList.has(benchmark.name.toLowerCase()));
}

this.JetStream = new Driver(benchmarks);
