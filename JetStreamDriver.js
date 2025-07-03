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

globalThis.performance ??= Date;
globalThis.RAMification ??= false;
globalThis.testIterationCount ??= undefined;
globalThis.testIterationCountMap ??= new Map();
globalThis.testWorstCaseCount ??= undefined;
globalThis.testWorstCaseCountMap ??= new Map();
globalThis.dumpJSONResults ??= false;
globalThis.customTestList ??= [];
globalThis.startDelay ??= undefined;

let shouldReport = false;

function getIntParam(urlParams, key) {
    if (!urlParams.has(key))
        return undefined
    const rawValue = urlParams.get(key);
    const value = parseInt(rawValue);
    if (value <= 0)
        throw new Error(`Expected positive value for ${key}, but got ${rawValue}`)
    return value
}

if (typeof(URLSearchParams) !== "undefined") {
    const urlParameters = new URLSearchParams(window.location.search);
    shouldReport = urlParameters.has('report') && urlParameters.get('report').toLowerCase() == 'true';
    globalThis.startDelay = getIntParam(urlParameters, "startDelay");
    if (shouldReport && !globalThis.startDelay)
        globalThis.startDelay = 4000;
    if (urlParameters.has('test'))
        customTestList = urlParameters.getAll("test");
    globalThis.testIterationCount = getIntParam(urlParameters, "iterationCount");
    globalThis.testWorstCaseCount = getIntParam(urlParameters, "worstCaseCount");
}

// Used for the promise representing the current benchmark run.
this.currentResolve = null;
this.currentReject = null;

let showScoreDetails = false;
let categoryScores = null;

function displayCategoryScores() {
    if (!categoryScores)
        return;

    let summaryElement = document.getElementById("result-summary");
    for (let [category, scores] of categoryScores)
        summaryElement.innerHTML += `<p> ${category}: ${uiFriendlyScore(geomean(scores))}</p>`

    categoryScores = null;
}

function getIterationCount(plan) {
    if (testIterationCountMap.has(plan.name))
        return testIterationCountMap.get(plan.name);
    if (testIterationCount)
        return testIterationCount;
    if (plan.iterations)
        return plan.iterations;
    return defaultIterationCount;
}

function getWorstCaseCount(plan) {
    if (testWorstCaseCountMap.has(plan.name))
        return testWorstCaseCountMap.get(plan.name);
    if (testWorstCaseCount)
        return testWorstCaseCount;
    if (plan.worstCaseCount)
        return plan.worstCaseCount;
    return defaultWorstCaseCount;
}

if (isInBrowser) {
    document.onkeydown = (keyboardEvent) => {
        const key = keyboardEvent.key;
        if (key === "d" || key === "D") {
            showScoreDetails = true;

            displayCategoryScores();
        }
    };
}

function assert(b, m = "") {
    if (!b)
        throw new Error("Bad assertion: " + m);
}

function firstID(benchmark) {
    return `results-cell-${benchmark.name}-first`;
}

function worst4ID(benchmark) {
    return `results-cell-${benchmark.name}-worst4`;
}

function avgID(benchmark) {
    return `results-cell-${benchmark.name}-avg`;
}

function scoreID(benchmark) {
    return `results-cell-${benchmark.name}-score`;
}

function mean(values) {
    assert(values instanceof Array);
    let sum = 0;
    for (let x of values)
        sum += x;
    return sum / values.length;
}

function geomean(values) {
    assert(values instanceof Array);
    let product = 1;
    for (let x of values)
        product *= x;
    return product ** (1 / values.length);
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
    return num.toFixed(3);
}

function uiFriendlyScore(num) {
    return uiFriendlyNumber(num);
}

function uiFriendlyDuration(time)
{
    const minutes = time.getMinutes();
    const seconds = time.getSeconds();
    const milliSeconds = time.getMilliseconds();
    let result = "" + minutes + ":";

    result = result + (seconds < 10 ? "0" : "") + seconds + ".";
    result = result + (milliSeconds < 10 ? "00" : (milliSeconds < 100 ? "0" : "")) + milliSeconds;

    return result;
}

const fileLoader = (function() {
    class Loader {
        constructor() {
            this.requests = new Map;
        }

        async _loadInternal(url) {
            if (!isInBrowser)
                return Promise.resolve(readFile(url));

            let response;
            const tries = 3;
            while (tries--) {
                let hasError = false;
                try {
                    response = await fetch(url);
                } catch (e) {
                    hasError = true;
                }
                if (!hasError && response.ok)
                    break;
                if (tries)
                    continue;
                globalThis.allIsGood = false;
                throw new Error("Fetch failed");
            }
            if (url.indexOf(".js") !== -1)
                return response.text();
            else if (url.indexOf(".wasm") !== -1)
                return response.arrayBuffer();

            throw new Error("should not be reached!");
        }

        async load(url) {
            if (this.requests.has(url))
                return this.requests.get(url);

            const promise = this._loadInternal(url);
            this.requests.set(url, promise);
            return promise;
        }
    }
    return new Loader;
})();

class Driver {
    constructor() {
        this.isReady = false;
        this.isDone = false;
        this.errors = [];
        this.benchmarks = [];
        this.blobDataCache = { };
        this.loadCache = { };
        this.counter = { };
        this.counter.loadedResources = 0;
        this.counter.totalResources = 0;
        this.counter.failedPreloadResources = 0;
    }

    addBenchmark(benchmark) {
        this.benchmarks.push(benchmark);
        benchmark.fetchResources();
    }

    async start() {
        let statusElement = false;
        let summaryElement = false;
        if (isInBrowser) {
            statusElement = document.getElementById("status");
            summaryElement = document.getElementById("result-summary");
            statusElement.innerHTML = `<label>Running...</label>`;
        } else if (!dumpJSONResults)
            console.log("Starting JetStream3");

        await updateUI();

        const start = performance.now();
        for (const benchmark of this.benchmarks) {
            benchmark.updateUIBeforeRun();

            await updateUI();

            try {
                await benchmark.run();
            } catch(e) {
                this.reportError(benchmark, e);
                throw e;
            }

            benchmark.updateUIAfterRun();
            console.log(benchmark.name)

            if (isInBrowser) {
                const cache = JetStream.blobDataCache;
                for (const file of benchmark.plan.files) {
                    const blobData = cache[file];
                    blobData.refCount--;
                    if (!blobData.refCount)
                        cache[file] = undefined;
                }
            }
        }

        const totalTime = performance.now() - start;
        if (measureTotalTimeAsSubtest) {
            if (isInBrowser)
                document.getElementById("benchmark-total-time-score").innerHTML = uiFriendlyNumber(totalTime);
            else if (!dumpJSONResults)
                console.log("Total time:", uiFriendlyNumber(totalTime));
            allScores.push(totalTime);
        }

        const allScores = [];
        for (const benchmark of this.benchmarks)
            allScores.push(benchmark.score);

        categoryScores = new Map;
        for (const benchmark of this.benchmarks) {
            for (let category of Object.keys(benchmark.subScores()))
                categoryScores.set(category, []);
        }

        for (const benchmark of this.benchmarks) {
            for (let [category, value] of Object.entries(benchmark.subScores())) {
                const arr = categoryScores.get(category);
                arr.push(value);
            }
        }

        if (isInBrowser) {
            summaryElement.classList.add('done');
            summaryElement.innerHTML = "<div class=\"score\">" + uiFriendlyScore(geomean(allScores)) + "</div><label>Score</label>";
            summaryElement.onclick = displayCategoryScores;
            if (showScoreDetails)
                displayCategoryScores();
            statusElement.innerHTML = '';
        } else if (!dumpJSONResults) {
            console.log("\n");
            for (let [category, scores] of categoryScores)
                console.log(`${category}: ${uiFriendlyScore(geomean(scores))}`);

            console.log("\nTotal Score: ", uiFriendlyScore(geomean(allScores)), "\n");
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

    runCode(string)
    {
        if (!isInBrowser) {
            const scripts = string;
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

            globalObject.console = {
                log: globalObject.print,
                warn: (e) => { print("Warn: " + e); },
                error: (e) => { print("Error: " + e); },
                debug: (e) => { print("Debug: " + e); },
            };

            globalObject.self = globalObject;
            globalObject.top = {
                currentResolve,
                currentReject
            };

            globalObject.performance ??= performance;
            for (const script of scripts)
                globalObject.loadString(script);

            return isD8 ? realm : globalObject;
        }

        const magic = document.getElementById("magic");
        magic.contentDocument.body.textContent = "";
        magic.contentDocument.body.innerHTML = "<iframe id=\"magicframe\" frameborder=\"0\">";

        const magicFrame = magic.contentDocument.getElementById("magicframe");
        magicFrame.contentDocument.open();
        magicFrame.contentDocument.write("<!DOCTYPE html><head><title>benchmark payload</title></head><body>\n" + string + "</body></html>");

        return magicFrame;
    }

    prepareToRun()
    {
        this.benchmarks.sort((a, b) => a.plan.name.toLowerCase() < b.plan.name.toLowerCase() ? 1 : -1);

        let text = "";
        let newBenchmarks = [];
        for (const benchmark of this.benchmarks) {
            const description = Array.from(Object.keys(benchmark.subScores())) 
            description.push("Score")

            newBenchmarks.push(benchmark);
            const scoreIds = benchmark.scoreIdentifiers()
            const overallScoreId = scoreIds.pop();

            if (isInBrowser) {
                text +=
                    `<div class="benchmark" id="benchmark-${benchmark.name}">
                    <h3 class="benchmark-name"><a href="in-depth.html#${benchmark.name}">${benchmark.name}</a></h3>
                    <h4 class="score" id="${overallScoreId}">___</h4><p>`;
                for (let i = 0; i < scoreIds.length; i++) {
                    const scoreId = scoreIds[i];
                    const label = description[i];
                    text += `<span class="result"><span id="${scoreId}">___</span><label>${label}</label></span>`
                }
                text += `</p></div>`;
            }
        }

        if (!isInBrowser)
            return;

        for (let f = 0; f < 5; f++)
            text += `<div class="benchmark fill"></div>`;

        const timestamp = performance.now();
        document.getElementById('jetstreams').style.backgroundImage = `url('jetstreams.svg?${timestamp}')`;
        const resultsTable = document.getElementById("results");
        resultsTable.innerHTML = text;

        document.getElementById("magic").textContent = "";
        document.addEventListener('keypress', function (e) {
            if (e.which === 13)
                JetStream.start();
        });
    }

    reportError(benchmark, error)
    {
        this.pushError(benchmark.name, error);

        if (!isInBrowser)
            return;

        for (const id of benchmark.scoreIdentifiers()) {
            document.getElementById(id).innerHTML = "error";
            const benchmarkResultsUI = document.getElementById(`benchmark-${benchmark.name}`);
            benchmarkResultsUI.classList.remove("benchmark-running");
            benchmarkResultsUI.classList.add("benchmark-error");
        }
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
        await this.prefetchResourcesForBrowser();
        await this.fetchResources();
        this.prepareToRun();
        this.isReady = true;
        if (isInBrowser) {
            globalThis.dispatchEvent(new Event("JetStreamReady"));
            if (typeof(globalThis.startDelay) !== "undefined") {
                setTimeout(() => this.start(), globalThis.startDelay);
            }
        }
    }

    async prefetchResourcesForBrowser() {
        if (!isInBrowser)
            return;

        const promises = [];
        for (const benchmark of this.benchmarks)
            promises.push(benchmark.prefetchResourcesForBrowser());

        await Promise.all(promises);

        const counter = JetStream.counter;
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
    }

    async fetchResources() {
        const promises = [];
        for (const benchmark of this.benchmarks)
            promises.push(benchmark.fetchResources());
        await Promise.all(promises);

        if (!isInBrowser)
            return;

        const statusElement = document.getElementById("status");
        statusElement.classList.remove('loading');
        statusElement.innerHTML = `<a href="javascript:JetStream.start()" class="button">Start Test</a>`;
        statusElement.onclick = () => {
            statusElement.onclick = null;
            JetStream.start();
            return false;
        }
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
        if (dumpJSONResults) {
            console.log("\n");
            console.log(this.resultsJSON());
            console.log("\n");
        }
    }

    async reportScoreToRunBenchmarkRunner()
    {
        if (!isInBrowser)
            return;

        if (!shouldReport)
            return;

        const content = this.resultsJSON();
        await fetch("/report", {
            method: "POST",
            heeaders: {
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

class Benchmark {
    constructor(plan)
    {
        this.plan = plan;
        this.tags = new Set(plan.tags);
        this.iterations = getIterationCount(plan);
        this.isAsync = !!plan.isAsync;
        this.disabledByDefault = !!plan.disabledByDefault;
        this.scripts = null;
        this._resourcesPromise = null;
        this._state = BenchmarkState.READY;
    }

    get name() { return this.plan.name; }

    get isDone() {
        return this._state == BenchmarkState.DONE || this._state == BenchmarkState.ERROR;
    }
    get isSuccess() { return this._state = BenchmarkState.DONE; }

    get runnerCode() {
        return `
            let __benchmark = new Benchmark(${this.iterations});
            let results = [];
            let benchmarkName = "${this.name}";

            for (let i = 0; i < ${this.iterations}; i++) {
                if (__benchmark.prepareForNextIteration)
                    __benchmark.prepareForNextIteration();

                ${this.preIterationCode}

                const iterationMarkLabel = benchmarkName + "-iteration-" + i;
                const iterationStartMark = performance.mark(iterationMarkLabel);

                let start = performance.now();
                __benchmark.runIteration();
                let end = performance.now();

                performanceMeasure(iterationMarkLabel, iterationStartMark);

                ${this.postIterationCode}

                results.push(Math.max(1, end - start));
            }
            if (__benchmark.validate)
                __benchmark.validate(${this.iterations});
            top.currentResolve(results);`;
    }

    processResults() {
        throw new Error("Subclasses need to implement this");
    }

    get score() {
        throw new Error("Subclasses need to implement this");
    }

    get prerunCode() { return null; }

    get preIterationCode() {
        let code = "";
        if (this.plan.deterministicRandom)
            code += `Math.random.__resetSeed();`;

        if (globalThis.customPreIterationCode)
            code += customPreIterationCode;

        return code;
    }

    get postIterationCode() {
        let code = "";

        if (globalThis.customPostIterationCode)
            code += customPostIterationCode;

        return code;
    }

    async run() {
        if (this.isDone)
            throw new Error(`Cannot run Benchmark ${this.name} twice`);
        this._state = BenchmarkState.PREPARE;
        let code;
        if (isInBrowser)
            code = "";
        else
            code = [];

        const addScript = (text) => {
            if (isInBrowser)
                code += `<script>${text}</script>`;
            else
                code.push(text);
        };

        const addScriptWithURL = (url) => {
            if (isInBrowser)
                code += `<script src="${url}"></script>`;
            else
                assert(false, "Should not reach here in CLI");
        };

        addScript(`
            const isInBrowser = ${isInBrowser};
            const isD8 = ${isD8};
            if (typeof performance.mark === 'undefined') {
                performance.mark = function() {};
            }
            if (typeof performance.measure === 'undefined') {
                performance.measure = function() {};
            }
            function performanceMeasure(name, mark) {
                // D8 does not implement the official web API.
                // Also the performance.mark polyfill returns an undefined mark.
                if (isD8 || typeof mark === "undefined")
                    performance.measure(name, mark);
                else
                    performance.measure(name, mark.name);
            }
        `);

        if (!!this.plan.deterministicRandom) {
            addScript(`
                 (() => {
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
                })();
            `);
        }

        if (this.plan.preload) {
            let str = "";
            for (let [variableName, blobUrl] of this.preloads)
                str += `const ${variableName} = "${blobUrl}";\n`;
            addScript(str);
        }

        const prerunCode = this.prerunCode;
        if (prerunCode)
            addScript(prerunCode);

        if (!isInBrowser) {
            assert(this.scripts && this.scripts.length === this.plan.files.length);

            for (const text of this.scripts)
                addScript(text);
        } else {
            const cache = JetStream.blobDataCache;
            for (const file of this.plan.files)
                addScriptWithURL(cache[file].blobURL);
        }

        const promise = new Promise((resolve, reject) => {
            currentResolve = resolve;
            currentReject = reject;
        });

        if (isInBrowser) {
            code = `
                <script> window.onerror = top.currentReject; </script>
                ${code}
            `;
        }
        addScript(this.runnerCode);

        this.startTime = performance.now();

        if (RAMification)
            resetMemoryPeak();

        let magicFrame;
        try {
            this._state = BenchmarkState.RUNNING;
            magicFrame = JetStream.runCode(code);
        } catch(e) {
            this._state = BenchmarkState.ERROR;
            console.log("Error in runCode: ", e);
            console.log(e.stack)
            throw e;
        } finally {
            this._state = BenchmarkState.FINALIZE;
        }
        const results = await promise;

        this.endTime = performance.now();

        if (RAMification) {
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

    async doLoadBlob(resource) {
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
        const blob = await response.blob();
        const blobData = JetStream.blobDataCache[resource];
        blobData.blob = blob;
        blobData.blobURL = URL.createObjectURL(blob);
        return blobData;
    }

    async loadBlob(type, prop, resource, incrementRefCount = true) {
        let blobData = JetStream.blobDataCache[resource];
        if (!blobData) {
            blobData = {
                type: type,
                prop: prop,
                resource: resource,
                blob: null,
                blobURL: null,
                refCount: 0
            };
            JetStream.blobDataCache[resource] = blobData;
        }

        if (incrementRefCount)
            blobData.refCount++;

        let promise = JetStream.loadCache[resource];
        if (promise)
            return promise;

        promise = this.doLoadBlob(resource);
        JetStream.loadCache[resource] = promise;
        return promise;
    }

    updateCounter() {
        const counter = JetStream.counter;
        ++counter.loadedResources;
        var statusElement = document.getElementById("status");
        statusElement.innerHTML = `Loading ${counter.loadedResources} of ${counter.totalResources} ...`;
    }

    prefetchResourcesForBrowser() {
        if (!isInBrowser)
            return;
        const promises = this.plan.files.map((file) => this.loadBlob("file", null, file).then((blobData) => {
                if (!globalThis.allIsGood)
                    return;
                this.updateCounter();
            }).catch((error) => {
                // We'll try again later in retryPrefetchResourceForBrowser(). Don't throw an error.
            }));

        if (this.plan.preload) {
            this.preloads = [];
            for (let prop of Object.getOwnPropertyNames(this.plan.preload)) {
                promises.push(this.loadBlob("preload", prop, this.plan.preload[prop]).then((blobData) => {
                    if (!globalThis.allIsGood)
                        return;
                    this.preloads.push([ blobData.prop, blobData.blobURL ]);
                    this.updateCounter();
                }).catch((error) => {
                    // We'll try again later in retryPrefetchResourceForBrowser(). Don't throw an error.
                    if (!this.failedPreloads)
                        this.failedPreloads = { };
                    this.failedPreloads[prop] = true;
                    JetStream.counter.failedPreloadResources++;
                }));
            }
        }

        JetStream.counter.totalResources += promises.length;
        return Promise.all(promises);
    }

    async retryPrefetchResource(type, prop, file) {
        const counter = JetStream.counter;
        const blobData = JetStream.blobDataCache[file];
        if (blobData.blob) {
            // The same preload blob may be used by multiple subtests. Though the blob is already loaded,
            // we still need to check if this subtest failed to load it before. If so, handle accordingly.
            if (type == "preload") {
                if (this.failedPreloads && this.failedPreloads[blobData.prop]) {
                    this.failedPreloads[blobData.prop] = false;
                    this.preloads.push([ blobData.prop, blobData.blobURL ]);
                    counter.failedPreloadResources--;
                }
            }
            return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
        }

        // Retry fetching the resource.
        JetStream.loadCache[file] = null;
        await this.loadBlob(type, prop, file, false).then((blobData) => {
            if (!globalThis.allIsGood)
                return;
            if (blobData.type == "preload")
                this.preloads.push([ blobData.prop, blobData.blobURL ]);
            this.updateCounter();
        });

        if (!blobData.blob) {
            globalThis.allIsGood = false;
            throw new Error("Fetch failed");
        }

        return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
    }

    async retryPrefetchResourcesForBrowser() {
        if (!isInBrowser)
            return;

        const counter = JetStream.counter;
        for (const resource of this.plan.files) {
            const allDone = await this.retryPrefetchResource("file", null, resource);
            if (allDone)
                return true; // All resources loaded, nothing more to do.
        }

        if (this.plan.preload) {
            for (const prop of Object.getOwnPropertyNames(this.plan.preload)) {
                const resource = this.plan.preload[prop];
                const allDone = await this.retryPrefetchResource("preload", prop, resource);
                if (allDone)
                    return true; // All resources loaded, nothing more to do.
            }
        }
        return !counter.failedPreloadResources && counter.loadedResources == counter.totalResources;
    }

    fetchResources() {
        if (this._resourcesPromise)
            return this._resourcesPromise;

        const filePromises = !isInBrowser ? this.plan.files.map((file) => fileLoader.load(file)) : [];

        const promise = Promise.all(filePromises).then((texts) => {
            if (isInBrowser)
                return;
            this.scripts = [];
            assert(texts.length === this.plan.files.length);
            for (const text of texts)
                this.scripts.push(text);
        });

        this.preloads = [];
        this.blobs = [];

        this._resourcesPromise = promise;
        return this._resourcesPromise;
    }

    scoreIdentifiers() { throw new Error("Must be implemented by subclasses"); }

    updateUIBeforeRun() {
        if (!isInBrowser) {
            if (!dumpJSONResults)
                console.log(`Running ${this.name}:`);
            return;
        }

        const containerUI = document.getElementById("results");
        const resultsBenchmarkUI = document.getElementById(`benchmark-${this.name}`);
        containerUI.insertBefore(resultsBenchmarkUI, containerUI.firstChild);
        resultsBenchmarkUI.classList.add("benchmark-running");

        for (const id of this.scoreIdentifiers())
            document.getElementById(id).innerHTML = "...";
    }

    updateUIAfterRun() {
        if (!isInBrowser)
            return;

        const benchmarkResultsUI = document.getElementById(`benchmark-${this.name}`);
        benchmarkResultsUI.classList.remove("benchmark-running");
        benchmarkResultsUI.classList.add("benchmark-done");

    }
};

class DefaultBenchmark extends Benchmark {
    constructor(...args) {
        super(...args);

        this.worstCaseCount = getWorstCaseCount(this.plan);
        this.firstIterationTime = null;
        this.firstIterationScore = null;
        this.worst4Time = null;
        this.worst4Score = null;
        this.averageTime = null;
        this.averageScore = null;

        assert(this.iterations > this.worstCaseCount);
    }

    processResults(results) {
        function copyArray(a) {
            const result = [];
            for (let x of a)
                result.push(x);
            return result;
        }
        results = copyArray(results);

        this.firstIterationTime = results[0];
        this.firstIterationScore = toScore(results[0]);

        results = results.slice(1);
        results.sort((a, b) => a < b ? 1 : -1);
        for (let i = 0; i + 1 < results.length; ++i)
            assert(results[i] >= results[i + 1]);

        const worstCase = [];
        for (let i = 0; i < this.worstCaseCount; ++i)
            worstCase.push(results[i]);
        this.worst4Time = mean(worstCase);
        this.worst4Score = toScore(this.worst4Time);
        this.averageTime = mean(results);
        this.averageScore = toScore(this.averageTime);
    }

    get score() {
        return geomean([this.firstIterationScore, this.worst4Score, this.averageScore]);
    }

    subScores() {
        return {
            "First": this.firstIterationScore,
            "Worst": this.worst4Score,
            "Average": this.averageScore,
        };
    }

    scoreIdentifiers() {
        return [firstID(this), worst4ID(this), avgID(this), scoreID(this)];
    }

    updateUIAfterRun() {
        super.updateUIAfterRun();

        if (isInBrowser) {
            document.getElementById(firstID(this)).innerHTML = uiFriendlyScore(this.firstIterationScore);
            document.getElementById(worst4ID(this)).innerHTML = uiFriendlyScore(this.worst4Score);
            document.getElementById(avgID(this)).innerHTML = uiFriendlyScore(this.averageScore);
            document.getElementById(scoreID(this)).innerHTML = uiFriendlyScore(this.score);
            return;
        }

        if (dumpJSONResults)
            return;

        console.log("    Startup:", uiFriendlyScore(this.firstIterationScore));
        console.log("    Worst Case:", uiFriendlyScore(this.worst4Score));
        console.log("    Average:", uiFriendlyScore(this.averageScore));
        console.log("    Score:", uiFriendlyScore(this.score));
        if (RAMification) {
            console.log("    Current Footprint:", uiFriendlyNumber(this.currentFootprint));
            console.log("    Peak Footprint:", uiFriendlyNumber(this.peakFootprint));
        }
        console.log("    Wall time:", uiFriendlyDuration(new Date(this.endTime - this.startTime)));
    }
}

class AsyncBenchmark extends DefaultBenchmark {
    get runnerCode() {
        return `
        async function doRun() {
            let __benchmark = new Benchmark();
            if (__benchmark.init)
                await __benchmark.init();
            let results = [];
            let benchmarkName = "${this.name}";

            for (let i = 0; i < ${this.iterations}; i++) {
                ${this.preIterationCode}

                const iterationMarkLabel = benchmarkName + "-iteration-" + i;
                const iterationStartMark = performance.mark(iterationMarkLabel);

                let start = performance.now();
                await __benchmark.runIteration();
                let end = performance.now();

                performanceMeasure(iterationMarkLabel, iterationStartMark);

                ${this.postIterationCode}

                results.push(Math.max(1, end - start));
            }
            if (__benchmark.validate)
                __benchmark.validate(${this.iterations});
            top.currentResolve(results);
        }
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

            oldPrint = globalObject.print;
            globalObject.print = globalObject.printErr = (...args) => {
                if (verbose)
                    console.log('Intercepted print: ', ...args);
            };

            let Module = {
                preRun: [],
                postRun: [],
                noInitialRun: true,
                print: print,
                printErr: printErr,
                setStatus: function(text) {
                },
                totalDependencies: 0,
                monitorRunDependencies: function(left) {
                    this.totalDependencies = Math.max(this.totalDependencies, left);
                    Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
                },
            };
            globalObject.Module = Module;
            `;
        return str;
    }

    // FIXME: Why is this part of the runnerCode and not prerunCode?
    get runnerCode() {
        let str = `function loadBlob(key, path, andThen) {`;

        if (isInBrowser) {
            str += `
                var xhr = new XMLHttpRequest();
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
            Module[key] = new Int8Array(read(path, "binary"));

            Module.setStatus = null;
            Module.monitorRunDependencies = null;

            Promise.resolve(42).then(() => {
                try {
                    andThen();
                } catch(e) {
                    console.log("error running wasm:", e);
                    console.log(e.stack);
                    throw e;
                }
            })
            `;
        }

        str += "}";

        let keys = Object.keys(this.plan.preload);
        for (let i = 0; i < keys.length; ++i) {
            str += `loadBlob("${keys[i]}", "${this.plan.preload[keys[i]]}", async () => {\n`;
        }

        str += super.runnerCode;
        for (let i = 0; i < keys.length; ++i) {
            str += `})`;
        }
        str += `;`;

        return str;
    }
};

class WSLBenchmark extends Benchmark {
    constructor(...args) {
        super(...args);

        this.stdlibTime = null;
        this.stdlibScore = null;
        this.mainRunTime = null;
        this.mainRunScore = null;
    }

    processResults(results) {
        this.stdlibTime = results[0];
        this.stdlibScore = toScore(results[0]);
        this.mainRunTime = results[1];
        this.mainRunScore = toScore(results[1]);
    }

    get score() {
        return geomean([this.stdlibScore, this.mainRunScore]);
    }

    get runnerCode() {
        return `
            let benchmark = new Benchmark();
            const benchmarkName = "${this.name}";

            let results = [];
            {
                const markLabel = benchmarkName + "-stdlib";
                const startMark = performance.mark(markLabel);

                let start = performance.now();
                benchmark.buildStdlib();
                results.push(performance.now() - start);

                performanceMeasure(markLabel, startMark);
            }

            {
                const markLabel = benchmarkName + "-mainRun";
                const startMark = performance.mark(markLabel);

                let start = performance.now();
                benchmark.run();
                results.push(performance.now() - start);

                performanceMeasure(markLabel, startMark);
            }

            top.currentResolve(results);
            `;
    }

    subScores() {
        return {
            "Stdlib": this.stdlibScore,
            "MainRun": this.mainRunScore,
        };
    }

    scoreIdentifiers() {
        return ["wsl-stdlib-score", "wsl-tests-score", "wsl-score-score"];
    }

    updateUIAfterRun() {
        super.updateUIAfterRun();

        if (isInBrowser) {
            document.getElementById("wsl-stdlib-score").innerHTML = uiFriendlyScore(this.stdlibScore);
            document.getElementById("wsl-tests-score").innerHTML = uiFriendlyScore(this.mainRunScore);
            document.getElementById("wsl-score-score").innerHTML = uiFriendlyScore(this.score);
            return;
        }

        if (dumpJSONResults)
            return;

        console.log("    Stdlib:", uiFriendlyScore(this.stdlibScore));
        console.log("    Tests:", uiFriendlyScore(this.mainRunScore));
        console.log("    Score:", uiFriendlyScore(this.score));
        if (RAMification) {
            console.log("    Current Footprint:", uiFriendlyNumber(this.currentFootprint));
            console.log("    Peak Footprint:", uiFriendlyNumber(this.peakFootprint));
        }
        console.log("    Wall time:", uiFriendlyDuration(new Date(this.endTime - this.startTime)));
    }
};

class WasmLegacyBenchmark extends Benchmark {
    constructor(...args) {
        super(...args);

        this.startupTime = null;
        this.startupScore = null;
        this.runTime = null;
        this.runScore = null;
    }

    processResults(results) {
        this.startupTime = results[0];
        this.startupScore= toScore(results[0]);
        this.runTime = results[1];
        this.runScore = toScore(results[1]);
    }

    get score() {
        return geomean([this.startupScore, this.runScore]);
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

            oldPrint = globalObject.print;
            oldConsoleLog = globalObject.console.log;
            globalObject.print = globalObject.printErr = (...args) => {
                if (verbose)
                    oldConsoleLog('Intercepted print: ', ...args);
            };

            let Module = {
                preRun: [],
                postRun: [],
                print: globalObject.print,
                printErr: globalObject.print,
                setStatus: function(text) {
                },
                totalDependencies: 0,
                monitorRunDependencies: function(left) {
                    this.totalDependencies = Math.max(this.totalDependencies, left);
                    Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies-left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
                }
            };
            globalObject.Module = Module;
            `;
        return str;
    }

    get runnerCode() {
        let str = `function loadBlob(key, path, andThen) {`;

        if (isInBrowser) {
            str += `
                var xhr = new XMLHttpRequest();
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
            Module[key] = new Int8Array(read(path, "binary"));
            if (andThen == doRun) {
                globalObject.read = (...args) => {
                    console.log("should not be inside read: ", ...args);
                    throw new Error;
                };
            };

            Module.setStatus = null;
            Module.monitorRunDependencies = null;

            Promise.resolve(42).then(() => {
                try {
                    andThen();
                } catch(e) {
                    console.log("error running wasm:", e);
                    console.log(e.stack);
                    throw e;
                }
            })
            `;
        }

        str += "}";

        const keys = Object.keys(this.plan.preload);
        for (let i = 0; i < keys.length; ++i) {
            str += `loadBlob("${keys[i]}", "${this.plan.preload[keys[i]]}", () => {\n`;
        }
        if (this.plan.async) {
            str += `doRun().catch((e) => {
                console.log("error running wasm:", e);
                console.log(e.stack)
                throw e;
            });`;
        } else {
            str += `doRun();`
        }
        for (let i = 0; i < keys.length; ++i) {
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

    get startupID() {
        return `wasm-startup-id${this.name}`;
    }
    get runID() {
        return `wasm-run-id${this.name}`;
    }
    get scoreID() {
        return `wasm-score-id${this.name}`;
    }

    scoreIdentifiers() {
        return [this.startupID, this.runID, this.scoreID];
    }

    updateUIAfterRun() {
        super.updateUIAfterRun();

        if (isInBrowser) {
            document.getElementById(this.startupID).innerHTML = uiFriendlyScore(this.startupScore);
            document.getElementById(this.runID).innerHTML = uiFriendlyScore(this.runScore);
            document.getElementById(this.scoreID).innerHTML = uiFriendlyScore(this.score);
            return;
        }

        if (dumpJSONResults)
            return;

        console.log("    Startup:", uiFriendlyScore(this.startupScore));
        console.log("    Run time:", uiFriendlyScore(this.runScore));
        console.log("    Score:", uiFriendlyScore(this.score));
        if (RAMification) {
            console.log("    Current Footprint:", uiFriendlyNumber(this.currentFootprint));
            console.log("    Peak Footprint:", uiFriendlyNumber(this.peakFootprint));
        }
        console.log("    Wall time:", uiFriendlyDuration(new Date(this.endTime - this.startTime)));
    }
};

let BENCHMARKS = [
    // ARES
    new DefaultBenchmark({
        name: "Air",
        files: [
            "./ARES-6/Air/symbols.js"
            , "./ARES-6/Air/tmp_base.js"
            , "./ARES-6/Air/arg.js"
            , "./ARES-6/Air/basic_block.js"
            , "./ARES-6/Air/code.js"
            , "./ARES-6/Air/frequented_block.js"
            , "./ARES-6/Air/inst.js"
            , "./ARES-6/Air/opcode.js"
            , "./ARES-6/Air/reg.js"
            , "./ARES-6/Air/stack_slot.js"
            , "./ARES-6/Air/tmp.js"
            , "./ARES-6/Air/util.js"
            , "./ARES-6/Air/custom.js"
            , "./ARES-6/Air/liveness.js"
            , "./ARES-6/Air/insertion_set.js"
            , "./ARES-6/Air/allocate_stack.js"
            , "./ARES-6/Air/payload-gbemu-executeIteration.js"
            , "./ARES-6/Air/payload-imaging-gaussian-blur-gaussianBlur.js"
            , "./ARES-6/Air/payload-airjs-ACLj8C.js"
            , "./ARES-6/Air/payload-typescript-scanIdentifier.js"
            , "./ARES-6/Air/benchmark.js"
        ],
        tags: ["ARES"],
    }),
    new DefaultBenchmark({
        name: "Basic",
        files: [
            "./ARES-6/Basic/ast.js"
            , "./ARES-6/Basic/basic.js"
            , "./ARES-6/Basic/caseless_map.js"
            , "./ARES-6/Basic/lexer.js"
            , "./ARES-6/Basic/number.js"
            , "./ARES-6/Basic/parser.js"
            , "./ARES-6/Basic/random.js"
            , "./ARES-6/Basic/state.js"
            , "./ARES-6/Basic/util.js"
            , "./ARES-6/Basic/benchmark.js"
        ],
        tags: ["ARES"],
    }),
    new DefaultBenchmark({
        name: "ML",
        files: [
            "./ARES-6/ml/index.js"
            , "./ARES-6/ml/benchmark.js"
        ],
        iterations: 60,
        tags: ["ARES"],
    }),
    new DefaultBenchmark({
        name: "Babylon",
        files: [
            "./ARES-6/Babylon/index.js"
            , "./ARES-6/Babylon/benchmark.js"
        ],
        preload: {
            airBlob: "./ARES-6/Babylon/air-blob.js",
            basicBlob: "./ARES-6/Babylon/basic-blob.js",
            inspectorBlob: "./ARES-6/Babylon/inspector-blob.js",
            babylonBlob: "./ARES-6/Babylon/babylon-blob.js"
        },
        tags: ["ARES"],
    }),
    // CDJS
    new DefaultBenchmark({
        name: "cdjs",
        files: [
            "./cdjs/constants.js"
            , "./cdjs/util.js"
            , "./cdjs/red_black_tree.js"
            , "./cdjs/call_sign.js"
            , "./cdjs/vector_2d.js"
            , "./cdjs/vector_3d.js"
            , "./cdjs/motion.js"
            , "./cdjs/reduce_collision_set.js"
            , "./cdjs/simulator.js"
            , "./cdjs/collision.js"
            , "./cdjs/collision_detector.js"
            , "./cdjs/benchmark.js"
        ],
        iterations: 60,
        worstCaseCount: 3,
        tags: ["CDJS"],
    }),
    // CodeLoad
    new DefaultBenchmark({
        name: "first-inspector-code-load",
        files: [
            "./code-load/code-first-load.js"
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js"
        },
        tags: ["CodeLoad"],
    }),
    new DefaultBenchmark({
        name: "multi-inspector-code-load",
        files: [
            "./code-load/code-multi-load.js"
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js"
        },
        tags: ["CodeLoad"],
    }),
    // Octane
    new DefaultBenchmark({
        name: "Box2D",
        files: [
            "./Octane/box2d.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "octane-code-load",
        files: [
            "./Octane/code-first-load.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "crypto",
        files: [
            "./Octane/crypto.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "delta-blue",
        files: [
            "./Octane/deltablue.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "earley-boyer",
        files: [
            "./Octane/earley-boyer.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "gbemu",
        files: [
            "./Octane/gbemu-part1.js"
            , "./Octane/gbemu-part2.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "mandreel",
        files: [
            "./Octane/mandreel.js"
        ],
        iterations: 80,
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "navier-stokes",
        files: [
            "./Octane/navier-stokes.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "pdfjs",
        files: [
            "./Octane/pdfjs.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "raytrace",
        files: [
            "./Octane/raytrace.js"
        ],
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "regexp",
        files: [
            "./Octane/regexp.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "richards",
        files: [
            "./Octane/richards.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "splay",
        files: [
            "./Octane/splay.js"
        ],
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    new DefaultBenchmark({
        name: "typescript",
        files: [
            "./Octane/typescript-compiler.js"
            , "./Octane/typescript-input.js"
            , "./Octane/typescript.js"
        ],
        iterations: 15,
        worstCaseCount: 2,
        deterministicRandom: true,
        tags: ["Octane"],
    }),
    // RexBench
    new DefaultBenchmark({
        name: "FlightPlanner",
        files: [
            "./RexBench/FlightPlanner/airways.js"
            , "./RexBench/FlightPlanner/waypoints.js"
            , "./RexBench/FlightPlanner/flight_planner.js"
            , "./RexBench/FlightPlanner/expectations.js"
            , "./RexBench/FlightPlanner/benchmark.js"
        ],
        tags: ["RexBench"],
    }),
    new DefaultBenchmark({
        name: "OfflineAssembler",
        files: [
            "./RexBench/OfflineAssembler/registers.js"
            , "./RexBench/OfflineAssembler/instructions.js"
            , "./RexBench/OfflineAssembler/ast.js"
            , "./RexBench/OfflineAssembler/parser.js"
            , "./RexBench/OfflineAssembler/file.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter32_64.js"
            , "./RexBench/OfflineAssembler/LowLevelInterpreter64.js"
            , "./RexBench/OfflineAssembler/InitBytecodes.js"
            , "./RexBench/OfflineAssembler/expected.js"
            , "./RexBench/OfflineAssembler/benchmark.js"
        ],
        iterations: 80,
        tags: ["RexBench"],
    }),
    new DefaultBenchmark({
        name: "UniPoker",
        files: [
            "./RexBench/UniPoker/poker.js"
            , "./RexBench/UniPoker/expected.js"
            , "./RexBench/UniPoker/benchmark.js"
        ],
        deterministicRandom: true,
        tags: ["RexBench"],
    }),
    // Simple
    new DefaultBenchmark({
        name: "hash-map",
        files: [
            "./simple/hash-map.js"
        ],
        tags: ["Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-promise",
        files: [
            "./simple/doxbee-promise.js",
        ],
        tags: ["Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-async",
        files: [
            "./simple/doxbee-async.js",
        ],
        tags: ["Simple"],
    }),
    // SeaMonster
    new DefaultBenchmark({
        name: "ai-astar",
        files: [
            "./SeaMonster/ai-astar.js"
        ],
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "gaussian-blur",
        files: [
            "./SeaMonster/gaussian-blur.js"
        ],
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-aes",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-aes.js"
        ],
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-pbkdf2",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-pbkdf2.js"
        ],
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-sha256",
        files: [
            "./SeaMonster/sjlc.js"
            , "./SeaMonster/stanford-crypto-sha256.js"
        ],
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-stringify-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js"
            , "./SeaMonster/json-stringify-inspector.js"
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-parse-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js"
            , "./SeaMonster/json-parse-inspector.js"
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["SeaMonster"],
    }),
    // BigInt
    new AsyncBenchmark({
        name: "bigint-noble-bls12-381",
        files: [
            "./bigint/web-crypto-sham.js",
            "./bigint/noble-bls12-381-bundle.js",
            "./bigint/noble-benchmark.js",
        ],
        iterations: 4,
        worstCaseCount: 1,
        deterministicRandom: true,
        tags: ["BigIntNoble"],
        disabledByDefault: true,
    }),
    new AsyncBenchmark({
        name: "bigint-noble-secp256k1",
        files: [
            "./bigint/web-crypto-sham.js",
            "./bigint/noble-secp256k1-bundle.js",
            "./bigint/noble-benchmark.js",
        ],
        deterministicRandom: true,
        tags: ["BigIntNoble"],
        disabledByDefault: true,
    }),
    new AsyncBenchmark({
        name: "bigint-noble-ed25519",
        files: [
            "./bigint/web-crypto-sham.js",
            "./bigint/noble-ed25519-bundle.js",
            "./bigint/noble-benchmark.js",
        ],
        iterations: 30,
        deterministicRandom: true,
        tags: ["BigIntNoble"],
    }),
    new DefaultBenchmark({
        name: "bigint-paillier",
        files: [
            "./bigint/web-crypto-sham.js",
            "./bigint/paillier-bundle.js",
            "./bigint/paillier-benchmark.js",
        ],
        iterations: 10,
        worstCaseCount: 2,
        deterministicRandom: true,
        tags: ["BigIntMisc"],
        disabledByDefault: true,
    }),
    new DefaultBenchmark({
        name: "bigint-bigdenary",
        files: [
            "./bigint/bigdenary-bundle.js",
            "./bigint/bigdenary-benchmark.js",
        ],
        iterations: 160,
        worstCaseCount: 16,
        tags: ["BigIntMisc"],
        disabledByDefault: true,
    }),
    // Proxy
    new AsyncBenchmark({
        name: "proxy-mobx",
        files: [
            "./proxy/common.js",
            "./proxy/mobx-bundle.js",
            "./proxy/mobx-benchmark.js",
        ],
        iterations: defaultIterationCount * 3,
        worstCaseCount: defaultWorstCaseCount * 3,
        tags: ["Proxy"],
    }),
    new AsyncBenchmark({
        name: "proxy-vue",
        files: [
            "./proxy/common.js",
            "./proxy/vue-bundle.js",
            "./proxy/vue-benchmark.js",
        ],
        tags: ["Proxy"]
    }),
    // Class fields
    new DefaultBenchmark({
        name: "raytrace-public-class-fields",
        files: [
            "./class-fields/raytrace-public-class-fields.js",
        ],
        tags: ["ClassFields"]
    }),
    new DefaultBenchmark({
        name: "raytrace-private-class-fields",
        files: [
            "./class-fields/raytrace-private-class-fields.js",
        ],
        tags: ["ClassFields"]
    }),
    // Generators
    new AsyncBenchmark({
        name: "async-fs",
        files: [
            "./generators/async-file-system.js",
        ],
        iterations: 80,
        worstCaseCount: 6,
        deterministicRandom: true,
        tags: ["Generators"]
    }),
    new DefaultBenchmark({
        name: "sync-fs",
        files: [
            "./generators/sync-file-system.js",
        ],
        iterations: 80,
        worstCaseCount: 6,
        deterministicRandom: true,
        tags: ["Generators"]
    }),
    new DefaultBenchmark({
        name: "lazy-collections",
        files: [
            "./generators/lazy-collections.js",
        ],
        tags: ["Generators"]
    }),
    new DefaultBenchmark({
        name: "js-tokens",
        files: [
            "./generators/js-tokens.js",
        ],
        tags: ["Generators"]
    }),
    // Wasm
    new WasmEMCCBenchmark({
        name: "HashSet-wasm",
        files: [
            "./wasm/HashSet/build/HashSet.js",
            "./wasm/HashSet/benchmark.js"
        ],
        preload: {
            wasmBinary: "./wasm/HashSet/build/HashSet.wasm"
        },
        iterations: 50,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "tsf-wasm",
        files: [
            "./wasm/TSF/build/tsf.js",
            "./wasm/TSF/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/TSF/build/tsf.wasm"
        },
        iterations: 50,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "quicksort-wasm",
        files: [
            "./wasm/quicksort/build/quicksort.js",
            "./wasm/quicksort/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/quicksort/build/quicksort.wasm"
        },
        iterations: 50,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "gcc-loops-wasm",
        files: [
            "./wasm/gcc-loops/build/gcc-loops.js",
            "./wasm/gcc-loops/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/gcc-loops/build/gcc-loops.wasm"
        },
        iterations: 50,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "richards-wasm",
        files: [
            "./wasm/richards/build/richards.js",
            "./wasm/richards/benchmark.js"
        ],
        preload: {
            wasmBinary: "./wasm/richards/build/richards.wasm"
        },
        iterations: 50,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "sqlite3-wasm",
        files: [
            "./sqlite3/benchmark.js",
            "./sqlite3/build/jswasm/speedtest1.js",
        ],
        preload: {
            wasmBinary: "./sqlite3/build/jswasm/speedtest1.wasm"
        },
        iterations: 30,
        worstCaseCount: 2,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Dart-flute-wasm",
        files: [
            "./Dart/benchmark.js",
        ],
        preload: {
            wasmBinary: "./Dart/build/flute.dart2wasm.wasm"
        },
        iterations: 15,
        worstCaseCount: 2,
        tags: ["Wasm"],
    }),
    new WasmLegacyBenchmark({
        name: "tfjs-wasm",
        files: [
            "./wasm/tfjs-model-helpers.js",
            "./wasm/tfjs-model-mobilenet-v3.js",
            "./wasm/tfjs-model-mobilenet-v1.js",
            "./wasm/tfjs-model-coco-ssd.js",
            "./wasm/tfjs-model-use.js",
            "./wasm/tfjs-model-use-vocab.js",
            "./wasm/tfjs-bundle.js",
            "./wasm/tfjs.js",
            "./wasm/tfjs-benchmark.js"
        ],
        preload: {
            tfjsBackendWasmBlob: "./wasm/tfjs-backend-wasm.wasm",
        },
        async: true,
        deterministicRandom: true,
        tags: ["Wasm"],
    }),
    new WasmLegacyBenchmark({
        name: "tfjs-wasm-simd",
        files: [
            "./wasm/tfjs-model-helpers.js",
            "./wasm/tfjs-model-mobilenet-v3.js",
            "./wasm/tfjs-model-mobilenet-v1.js",
            "./wasm/tfjs-model-coco-ssd.js",
            "./wasm/tfjs-model-use.js",
            "./wasm/tfjs-model-use-vocab.js",
            "./wasm/tfjs-bundle.js",
            "./wasm/tfjs.js",
            "./wasm/tfjs-benchmark.js"
        ],
        preload: {
            tfjsBackendWasmSimdBlob: "./wasm/tfjs-backend-wasm-simd.wasm",
        },
        async: true,
        deterministicRandom: true,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "argon2-wasm",
        files: [
            "./wasm/argon2/build/argon2.js",
            "./wasm/argon2/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/argon2/build/argon2.wasm"
        },
        iterations: 30,
        worstCaseCount: 3,
        deterministicRandom: true,
        tags: ["Wasm"],
    }),
    // WorkerTests
    new AsyncBenchmark({
        name: "bomb-workers",
        files: [
            "./worker/bomb.js"
        ],
        iterations: 80,
        preload: {
            rayTrace3D: "./worker/bomb-subtests/3d-raytrace.js"
            , accessNbody: "./worker/bomb-subtests/access-nbody.js"
            , morph3D: "./worker/bomb-subtests/3d-morph.js"
            , cube3D: "./worker/bomb-subtests/3d-cube.js"
            , accessFunnkuch: "./worker/bomb-subtests/access-fannkuch.js"
            , accessBinaryTrees: "./worker/bomb-subtests/access-binary-trees.js"
            , accessNsieve: "./worker/bomb-subtests/access-nsieve.js"
            , bitopsBitwiseAnd: "./worker/bomb-subtests/bitops-bitwise-and.js"
            , bitopsNsieveBits: "./worker/bomb-subtests/bitops-nsieve-bits.js"
            , controlflowRecursive: "./worker/bomb-subtests/controlflow-recursive.js"
            , bitops3BitBitsInByte: "./worker/bomb-subtests/bitops-3bit-bits-in-byte.js"
            , botopsBitsInByte: "./worker/bomb-subtests/bitops-bits-in-byte.js"
            , cryptoAES: "./worker/bomb-subtests/crypto-aes.js"
            , cryptoMD5: "./worker/bomb-subtests/crypto-md5.js"
            , cryptoSHA1: "./worker/bomb-subtests/crypto-sha1.js"
            , dateFormatTofte: "./worker/bomb-subtests/date-format-tofte.js"
            , dateFormatXparb: "./worker/bomb-subtests/date-format-xparb.js"
            , mathCordic: "./worker/bomb-subtests/math-cordic.js"
            , mathPartialSums: "./worker/bomb-subtests/math-partial-sums.js"
            , mathSpectralNorm: "./worker/bomb-subtests/math-spectral-norm.js"
            , stringBase64: "./worker/bomb-subtests/string-base64.js"
            , stringFasta: "./worker/bomb-subtests/string-fasta.js"
            , stringValidateInput: "./worker/bomb-subtests/string-validate-input.js"
            , stringTagcloud: "./worker/bomb-subtests/string-tagcloud.js"
            , stringUnpackCode: "./worker/bomb-subtests/string-unpack-code.js"
            , regexpDNA: "./worker/bomb-subtests/regexp-dna.js"
        },
        tags: ["WorkerTests"],
    }),
    new AsyncBenchmark({
        name: "segmentation",
        files: [
            "./worker/segmentation.js"
        ],
        preload: {
            asyncTaskBlob: "./worker/async-task.js"
        },
        iterations: 36,
        worstCaseCount: 3,
        tags: ["WorkerTests"],
    }),
    // WSL
    new WSLBenchmark({
        name: "WSL",
        files: ["./WSL/Node.js" ,"./WSL/Type.js" ,"./WSL/ReferenceType.js" ,"./WSL/Value.js" ,"./WSL/Expression.js" ,"./WSL/Rewriter.js" ,"./WSL/Visitor.js" ,"./WSL/CreateLiteral.js" ,"./WSL/CreateLiteralType.js" ,"./WSL/PropertyAccessExpression.js" ,"./WSL/AddressSpace.js" ,"./WSL/AnonymousVariable.js" ,"./WSL/ArrayRefType.js" ,"./WSL/ArrayType.js" ,"./WSL/Assignment.js" ,"./WSL/AutoWrapper.js" ,"./WSL/Block.js" ,"./WSL/BoolLiteral.js" ,"./WSL/Break.js" ,"./WSL/CallExpression.js" ,"./WSL/CallFunction.js" ,"./WSL/Check.js" ,"./WSL/CheckLiteralTypes.js" ,"./WSL/CheckLoops.js" ,"./WSL/CheckRecursiveTypes.js" ,"./WSL/CheckRecursion.js" ,"./WSL/CheckReturns.js" ,"./WSL/CheckUnreachableCode.js" ,"./WSL/CheckWrapped.js" ,"./WSL/Checker.js" ,"./WSL/CloneProgram.js" ,"./WSL/CommaExpression.js" ,"./WSL/ConstexprFolder.js" ,"./WSL/ConstexprTypeParameter.js" ,"./WSL/Continue.js" ,"./WSL/ConvertPtrToArrayRefExpression.js" ,"./WSL/DereferenceExpression.js" ,"./WSL/DoWhileLoop.js" ,"./WSL/DotExpression.js" ,"./WSL/DoubleLiteral.js" ,"./WSL/DoubleLiteralType.js" ,"./WSL/EArrayRef.js" ,"./WSL/EBuffer.js" ,"./WSL/EBufferBuilder.js" ,"./WSL/EPtr.js" ,"./WSL/EnumLiteral.js" ,"./WSL/EnumMember.js" ,"./WSL/EnumType.js" ,"./WSL/EvaluationCommon.js" ,"./WSL/Evaluator.js" ,"./WSL/ExpressionFinder.js" ,"./WSL/ExternalOrigin.js" ,"./WSL/Field.js" ,"./WSL/FindHighZombies.js" ,"./WSL/FlattenProtocolExtends.js" ,"./WSL/FlattenedStructOffsetGatherer.js" ,"./WSL/FloatLiteral.js" ,"./WSL/FloatLiteralType.js" ,"./WSL/FoldConstexprs.js" ,"./WSL/ForLoop.js" ,"./WSL/Func.js" ,"./WSL/FuncDef.js" ,"./WSL/FuncInstantiator.js" ,"./WSL/FuncParameter.js" ,"./WSL/FunctionLikeBlock.js" ,"./WSL/HighZombieFinder.js" ,"./WSL/IdentityExpression.js" ,"./WSL/IfStatement.js" ,"./WSL/IndexExpression.js" ,"./WSL/InferTypesForCall.js" ,"./WSL/Inline.js" ,"./WSL/Inliner.js" ,"./WSL/InstantiateImmediates.js" ,"./WSL/IntLiteral.js" ,"./WSL/IntLiteralType.js" ,"./WSL/Intrinsics.js" ,"./WSL/LateChecker.js" ,"./WSL/Lexer.js" ,"./WSL/LexerToken.js" ,"./WSL/LiteralTypeChecker.js" ,"./WSL/LogicalExpression.js" ,"./WSL/LogicalNot.js" ,"./WSL/LoopChecker.js" ,"./WSL/MakeArrayRefExpression.js" ,"./WSL/MakePtrExpression.js" ,"./WSL/NameContext.js" ,"./WSL/NameFinder.js" ,"./WSL/NameResolver.js" ,"./WSL/NativeFunc.js" ,"./WSL/NativeFuncInstance.js" ,"./WSL/NativeType.js" ,"./WSL/NativeTypeInstance.js" ,"./WSL/NormalUsePropertyResolver.js" ,"./WSL/NullLiteral.js" ,"./WSL/NullType.js" ,"./WSL/OriginKind.js" ,"./WSL/OverloadResolutionFailure.js" ,"./WSL/Parse.js" ,"./WSL/Prepare.js" ,"./WSL/Program.js" ,"./WSL/ProgramWithUnnecessaryThingsRemoved.js" ,"./WSL/PropertyResolver.js" ,"./WSL/Protocol.js" ,"./WSL/ProtocolDecl.js" ,"./WSL/ProtocolFuncDecl.js" ,"./WSL/ProtocolRef.js" ,"./WSL/PtrType.js" ,"./WSL/ReadModifyWriteExpression.js" ,"./WSL/RecursionChecker.js" ,"./WSL/RecursiveTypeChecker.js" ,"./WSL/ResolveNames.js" ,"./WSL/ResolveOverloadImpl.js" ,"./WSL/ResolveProperties.js" ,"./WSL/ResolveTypeDefs.js" ,"./WSL/Return.js" ,"./WSL/ReturnChecker.js" ,"./WSL/ReturnException.js" ,"./WSL/StandardLibrary.js" ,"./WSL/StatementCloner.js" ,"./WSL/StructLayoutBuilder.js" ,"./WSL/StructType.js" ,"./WSL/Substitution.js" ,"./WSL/SwitchCase.js" ,"./WSL/SwitchStatement.js" ,"./WSL/SynthesizeEnumFunctions.js" ,"./WSL/SynthesizeStructAccessors.js" ,"./WSL/TrapStatement.js" ,"./WSL/TypeDef.js" ,"./WSL/TypeDefResolver.js" ,"./WSL/TypeOrVariableRef.js" ,"./WSL/TypeParameterRewriter.js" ,"./WSL/TypeRef.js" ,"./WSL/TypeVariable.js" ,"./WSL/TypeVariableTracker.js" ,"./WSL/TypedValue.js" ,"./WSL/UintLiteral.js" ,"./WSL/UintLiteralType.js" ,"./WSL/UnificationContext.js" ,"./WSL/UnreachableCodeChecker.js" ,"./WSL/VariableDecl.js" ,"./WSL/VariableRef.js" ,"./WSL/VisitingSet.js" ,"./WSL/WSyntaxError.js" ,"./WSL/WTrapError.js" ,"./WSL/WTypeError.js" ,"./WSL/WhileLoop.js" ,"./WSL/WrapChecker.js", "./WSL/Test.js"],
        tags: ["WSL"],
    }),
    // 8bitbench
    new WasmEMCCBenchmark({
        name: "8bitbench-wasm",
        files: [
            "./8bitbench/build/lib/fast-text-encoding-1.0.3/text.js",
            "./8bitbench/build/rust/pkg/emu_bench.js",
            "./8bitbench/benchmark.js",
        ],
        preload: {
            wasmBinary: "./8bitbench/build/rust/pkg/emu_bench_bg.wasm",
            romBinary: "./8bitbench/build/assets/program.bin"
        },
        iterations: 15,
        worstCaseCount: 2,
        tags: ["Wasm"],
    }),
    // zlib-wasm
    new WasmEMCCBenchmark({
        name: "zlib-wasm",
        files: [
            "./wasm/zlib/build/zlib.js",
            "./wasm/zlib/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/zlib/build/zlib.wasm",
        },
        iterations: 40,
        tags: ["Wasm"],
    }),
];

// LuaJSFight tests
const luaJSFightTests = [
    "hello_world"
    , "list_search"
    , "lists"
    , "string_lists"
];
for (const test of luaJSFightTests) {
    BENCHMARKS.push(new DefaultBenchmark({
        name: `${test}-LJF`,
        files: [
            `./LuaJSFight/${test}.js`
        ],
        tags: ["LuaJSFight"],
    }));
}

// SunSpider tests
const SUNSPIDER_TESTS = [
    "3d-cube"
    , "3d-raytrace"
    , "base64"
    , "crypto-aes"
    , "crypto-md5"
    , "crypto-sha1"
    , "date-format-tofte"
    , "date-format-xparb"
    , "n-body"
    , "regex-dna"
    , "string-unpack-code"
    , "tagcloud"
];
for (const test of SUNSPIDER_TESTS) {
    BENCHMARKS.push(new DefaultBenchmark({
        name: `${test}-SP`,
        files: [
            `./SunSpider/${test}.js`
        ],
        tags: ["SunSpider"],
    }));
}

// WTB (Web Tooling Benchmark) tests
const WTB_TESTS = [
    "acorn"
    , "babylon"
    , "chai"
    , "coffeescript"
    , "espree"
    , "jshint"
    , "lebab"
    , "prepack"
    , "uglify-js"
];
for (const name of WTB_TESTS) {
    BENCHMARKS.push(new DefaultBenchmark({
        name: `${name}-wtb`,
        files: [
            isInBrowser ? "./web-tooling-benchmark/browser.js" : "./web-tooling-benchmark/cli.js"
            , `./web-tooling-benchmark/${name}.js`
        ],
        iterations: 5,
        worstCaseCount: 1,
        tags: ["WTB"],
    }));
}


const benchmarksByName = new Map();
const benchmarksByTag = new Map();

for (const benchmark of BENCHMARKS) {
    const name = benchmark.name;

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

this.JetStream = new Driver();

function enableBenchmarks(benchmarks, forceEnable = false)
{
    for (let benchmark of benchmarks) {
        if (!forceEnable && benchmark.disabledByDefault)
            return;

        JetStream.addBenchmark(benchmark);
    }
}

function enableBenchmarksByName(name)
{
    const benchmark = benchmarksByName.get(name);

    if (!benchmark)
        throw new Error(`Couldn't find benchmark named "${name}"`);

    // We only use this for test lists.
    JetStream.addBenchmark(benchmark);
}

function enableBenchmarksByTag(tag, forceEnable = false)
{
    const benchmarks = benchmarksByTag.get(tag);

    if (!benchmarks) {
        const validTags = Array.from(benchmarksByTag.keys()).join(", ");
        throw new Error(`Couldn't find tag named: ${tag}.\n Choices are ${validTags}`);
    }

    for (const benchmark of benchmarks) {
        if (!forceEnable && benchmark.disabledByDefault)
            continue;

        JetStream.addBenchmark(benchmark);
    }
}

function processTestList(testList)
{
    let benchmarkNames = [];

    if (testList instanceof Array)
        benchmarkNames = testList;
    else
        benchmarkNames = testList.split(/[\s,]/);

    const forceEnable = true;
    for (const name of benchmarkNames) {
        if (benchmarksByTag.has(name))
            enableBenchmarksByTag(name, forceEnable);
        else
            enableBenchmarksByName(name);
    }
}

let runOctane = true;
let runARES = true;
let runWSL = true;
let runRexBench = true;
let runWTB = true;
let runSunSpider = true;
let runBigIntNoble = true;
let runBigIntMisc = true;
let runProxy = true;
let runClassFields = true;
let runGenerators = true;
let runSimple = true;
let runCDJS = true;
let runWorkerTests = !!isInBrowser;
let runSeaMonster = true;
let runCodeLoad = true;
let runWasm = true;
if (typeof WebAssembly === "undefined")
    runWasm = false;

if (false) {
    runOctane = false;
    runARES = false;
    runWSL = false;
    runRexBench = false;
    runWTB = false;
    runSunSpider = false;
    runBigIntNoble = false;
    runBigIntMisc = false;
    runProxy = false;
    runClassFields = false;
    runGenerators = false;
    runSimple = false;
    runCDJS = false;
    runWorkerTests = false;
    runSeaMonster = false;
    runCodeLoad = false;
    runWasm = false;
}

if (typeof testList !== "undefined") {
    processTestList(testList);
} else if (customTestList.length) {
    processTestList(customTestList);
} else {
    if (runARES)
        enableBenchmarksByTag("ARES");

    if (runCDJS)
        enableBenchmarksByTag("CDJS");

    if (runCodeLoad)
        enableBenchmarksByTag("CodeLoad");

    if (runOctane)
        enableBenchmarksByTag("Octane");

    if (runRexBench)
        enableBenchmarksByTag("RexBench");

    if (runSeaMonster)
        enableBenchmarksByTag("SeaMonster");

    if (runSimple)
        enableBenchmarksByTag("Simple");

    if (runSunSpider)
        enableBenchmarksByTag("SunSpider");

    if (runBigIntNoble)
        enableBenchmarksByTag("BigIntNoble");

    if (runBigIntMisc)
        enableBenchmarksByTag("BigIntMisc");

    if (runProxy)
        enableBenchmarksByTag("Proxy");

    if (runClassFields)
        enableBenchmarksByTag("ClassFields");

    if (runGenerators)
        enableBenchmarksByTag("Generators");

    if (runWasm)
        enableBenchmarksByTag("Wasm");

    if (runWorkerTests)
        enableBenchmarksByTag("WorkerTests");

    if (runWSL)
        enableBenchmarksByTag("WSL");

    if (runWTB)
        enableBenchmarksByTag("WTB");
}
