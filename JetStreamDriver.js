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
globalThis.testList ??= undefined;
globalThis.startDelay ??= undefined;
globalThis.shouldReport ??= false;
globalThis.prefetchResources ??= true;

function getIntParam(urlParams, key) {
    const rawValue = urlParams.get(key);
    const value = parseInt(rawValue);
    if (value <= 0)
        throw new Error(`Expected positive value for ${key}, but got ${rawValue}`);
    return value;
}

function getBoolParam(urlParams, key) {
    const rawValue = urlParams.get(key).toLowerCase()
    return !(rawValue === "false" || rawValue === "0")
 }

function getTestListParam(urlParams, key) {
    if (globalThis.testList?.length)
        throw new Error(`Overriding previous testList=${globalThis.testList.join()} with ${key} url-parameter.`);
    return urlParams.getAll(key);
}

if (typeof(URLSearchParams) !== "undefined") {
    const urlParameters = new URLSearchParams(window.location.search);
    if (urlParameters.has("report"))
        globalThis.shouldReport = urlParameters.get("report").toLowerCase() == "true";
    if (urlParameters.has("startDelay"))
        globalThis.startDelay = getIntParam(urlParameters, "startDelay");
    if (globalThis.shouldReport && !globalThis.startDelay)
        globalThis.startDelay = 4000;
    if (urlParameters.has("tag"))
        globalThis.testList = getTestListParam(urlParameters, "tag");
    if (urlParameters.has("test"))
        globalThis.testList = getTestListParam(urlParameters, "test");
    if (urlParameters.has("iterationCount"))
        globalThis.testIterationCount = getIntParam(urlParameters, "iterationCount");
    if (urlParameters.has("worstCaseCount"))
        globalThis.testWorstCaseCount = getIntParam(urlParameters, "worstCaseCount");
    if (urlParameters.has("prefetchResources"))
        globalThis.prefetchResources = getBoolParam(urlParameters, "prefetchResources");
}

if (!globalThis.prefetchResources)
    console.warn("Disabling resource prefetching!");

// Used for the promise representing the current benchmark run.
this.currentResolve = null;
this.currentReject = null;

let showScoreDetails = false;
let categoryScores = null;

function displayCategoryScores() {
    if (!categoryScores)
        return;

    let scoreDetails = `<div class="benchmark benchmark-done">`;
    for (let [category, scores] of categoryScores) {
        scoreDetails += `<span class="result">
                <span>${uiFriendlyScore(geomeanScore(scores))}</span>
                <label>${category}</label>
            </span>`;
    }
    scoreDetails += "</div>";
    let summaryElement = document.getElementById("result-summary");
    summaryElement.innerHTML += scoreDetails;

    categoryScores = null;
}

function getIterationCount(plan) {
    if (testIterationCountMap.has(plan.name))
        return testIterationCountMap.get(plan.name);
    if (globalThis.testIterationCount)
        return globalThis.testIterationCount;
    if (plan.iterations)
        return plan.iterations;
    return defaultIterationCount;
}

function getWorstCaseCount(plan) {
    if (testWorstCaseCountMap.has(plan.name))
        return testWorstCaseCountMap.get(plan.name);
    if (globalThis.testWorstCaseCount)
        return globalThis.testWorstCaseCount;
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

function mean(values) {
    console.assert(values instanceof Array);
    let sum = 0;
    for (let x of values)
        sum += x;
    return sum / values.length;
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
    return `${time.toFixed(3)} ms`;
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
        if (!globalThis.prefetchResources)
            return `load("${url}");`

        if (this.requests.has(url)) {
            return this.requests.get(url);
        }

        const contents = readFile(url);
        this.requests.set(url, contents);
        return contents;
    }
};

const shellFileLoader = new ShellFileLoader();

class Driver {
    constructor(benchmarks) {
        this.isReady = false;
        this.isDone = false;
        this.errors = [];
        // Make benchmark list unique and sort it.
        this.benchmarks = Array.from(new Set(benchmarks));
        this.benchmarks.sort((a, b) => a.plan.name.toLowerCase() < b.plan.name.toLowerCase() ? 1 : -1);
        console.assert(this.benchmarks.length, "No benchmarks selected");
        // TODO: Cleanup / remove / merge `blobDataCache` and `loadCache` vs.
        // the global `fileLoader` cache.
        this.blobDataCache = { };
        this.loadCache = { };
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
        } else if (!dumpJSONResults)
            console.log("Starting JetStream3");

        performance.mark("update-ui-start");
        const start = performance.now();
        for (const benchmark of this.benchmarks) {
            await benchmark.updateUIBeforeRun();
            await updateUI();
            performance.measure("runner update-ui", "update-ui-start");

            try {
                await benchmark.run();
            } catch(e) {
                this.reportError(benchmark, e);
                throw e;
            }

            performance.mark("update-ui");
            benchmark.updateUIAfterRun();

            if (isInBrowser && globalThis.prefetchResources) {
                const cache = JetStream.blobDataCache;
                for (const file of benchmark.files) {
                    const blobData = cache[file];
                    blobData.refCount--;
                    if (!blobData.refCount)
                        cache[file] = undefined;
                }
            }
        }
        performance.measure("runner update-ui", "update-ui-start");

        const totalTime = performance.now() - start;
        if (measureTotalTimeAsSubtest) {
            if (isInBrowser)
                document.getElementById("benchmark-total-time-score").innerHTML = uiFriendlyNumber(totalTime);
            else if (!dumpJSONResults)
                console.log("Total time:", uiFriendlyNumber(totalTime));
            allScores.push(totalTime);
        }

        const allScores = [];
        for (const benchmark of this.benchmarks) {
            const score = benchmark.score;
            console.assert(score > 0, `Invalid ${benchmark.name} score: ${score}`);
            allScores.push(score);
        }

        categoryScores = new Map;
        for (const benchmark of this.benchmarks) {
            for (let category of Object.keys(benchmark.subScores()))
                categoryScores.set(category, []);
        }

        for (const benchmark of this.benchmarks) {
            for (let [category, value] of Object.entries(benchmark.subScores())) {
                const arr = categoryScores.get(category);
                console.assert(value > 0, `Invalid ${benchmark.name} ${category} score: ${value}`);
                arr.push(value);
            }
        }

        const totalScore = geomeanScore(allScores);
        console.assert(totalScore > 0, `Invalid total score: ${totalScore}`);

        if (isInBrowser) {
            const summaryElement = document.getElementById("result-summary");
            summaryElement.classList.add("done");
            summaryElement.innerHTML = `<div class="score">${uiFriendlyScore(totalScore)}</div>
                    <label>Score</label>`;
            summaryElement.onclick = displayCategoryScores;
            if (showScoreDetails)
                displayCategoryScores();
            statusElement.innerHTML = "";
        } else if (!dumpJSONResults) {
            console.log("\n");
            for (let [category, scores] of categoryScores)
                console.log(`${category}: ${uiFriendlyScore(geomeanScore(scores))}`);
            console.log("\nTotal Score: ", uiFriendlyScore(totalScore), "\n");
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

    prepareToRun() {
        this.benchmarks.sort((a, b) => a.plan.name.toLowerCase() < b.plan.name.toLowerCase() ? 1 : -1);

        let text = "";
        for (const benchmark of this.benchmarks) {
            const description = Object.keys(benchmark.subScores());
            description.push("Score");

            const scoreIds = benchmark.scoreIdentifiers();
            const overallScoreId = scoreIds.pop();

            if (isInBrowser) {
                text +=
                    `<div class="benchmark" id="benchmark-${benchmark.name}">
                    <h3 class="benchmark-name">${benchmark.name} <a class="info" href="in-depth.html#${benchmark.name}">i</a></h3>
                    <h4 class="score" id="${overallScoreId}">&nbsp;</h4>
                    <h4 class="plot" id="plot-${benchmark.name}">&nbsp;</h4>
                    <p>`;
                for (let i = 0; i < scoreIds.length; i++) {
                    const scoreId = scoreIds[i];
                    const label = description[i];
                    text += `<span class="result"><span id="${scoreId}">&nbsp;</span><label>${label}</label></span>`
                }
                text += `</p></div>`;
            }
        }

        if (!isInBrowser)
            return;

        const timestamp = performance.now();
        document.getElementById('jetstreams').style.backgroundImage = `url('jetstreams.svg?${timestamp}')`;
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
        await this.prefetchResources();
        this.prepareToRun();
        this.isReady = true;
        if (isInBrowser) {
            globalThis.dispatchEvent(new Event("JetStreamReady"));
            if (typeof(globalThis.startDelay) !== "undefined") {
                setTimeout(() => this.start(), globalThis.startDelay);
            }
        }
    }

    async prefetchResources() {
        if (!isInBrowser) {
            for (const benchmark of this.benchmarks)
                benchmark.prefetchResourcesForShell();
            return;
        }

        // TODO: Cleanup the browser path of the preloading below and in
        // `prefetchResourcesForBrowser` / `retryPrefetchResourcesForBrowser`.
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

        if (!globalThis.shouldReport)
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
    constructor() {
        this.scripts = [];
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
                },
            };
            `);
        this.add(`
            performance.mark ??= function(name) { return { name }};
            performance.measure ??= function() {};
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

        globalObject.performance ??= performance;
        for (const script of this.scripts)
            globalObject.loadString(script);

        return isD8 ? realm : globalObject;
    }

    add(text) {
        this.scripts.push(text);
    }

    addWithURL(url) {
        console.assert(false, "Should not reach here in CLI");
    }
}

class BrowserScripts extends Scripts {
    constructor() {
        super();
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
    constructor(plan)
    {
        this.plan = plan;
        this.tags = this.processTags(plan.tags)
        this.iterations = getIterationCount(plan);
        this.isAsync = !!plan.isAsync;
        this.allowUtf16 = !!plan.allowUtf16;
        this.scripts = null;
        this.preloads = null;
        this.results = [];
        this._state = BenchmarkState.READY;
    }

    processTags(rawTags) {
        const tags = new Set(rawTags.map(each => each.toLowerCase()));
        if (tags.size != rawTags.length)
            throw new Error(`${this.name} got duplicate tags: ${rawTags.join()}`);
        tags.add("all");
        if (!tags.has("default"))
            tags.add("disabled");
        return tags;
    }

    get name() { return this.plan.name; }
    get files() { return this.plan.files; }

    get isDone() {
        return this._state == BenchmarkState.DONE || this._state == BenchmarkState.ERROR;
    }
    get isSuccess() { return this._state = BenchmarkState.DONE; }

    hasAnyTag(...tags) {
        return tags.some((tag) => this.tags.has(tag.toLowerCase()));
    }

    get runnerCode() {
        return `{
            const benchmark = new Benchmark(${this.iterations});
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

    subScores() {
        throw new Error("Subclasses need to implement this");
    }

    allScores() {
        const allScores = this.subScores();
        allScores["Score"] = this.score;
        return allScores;
    }

    get prerunCode() { return null; }

    get preIterationCode() {
        let code = `benchmark.prepareForNextIteration?.();`;
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
        const scripts = isInBrowser ? new BrowserScripts() : new ShellScripts();

        if (!!this.plan.deterministicRandom)
            scripts.addDeterministicRandom()
        if (!!this.plan.exposeBrowserTest)
            scripts.addBrowserTest();

        if (this.plan.preload) {
            let preloadCode = "";
            for (let [ variableName, blobURLOrPath ] of this.preloads)
                preloadCode += `JetStream.preload.${variableName} = "${blobURLOrPath}";\n`;
            scripts.add(preloadCode);
        }

        const prerunCode = this.prerunCode;
        if (prerunCode)
            scripts.add(prerunCode);

        if (!isInBrowser) {
            console.assert(this.scripts && this.scripts.length === this.plan.files.length);
            for (const text of this.scripts)
                scripts.add(text);
        } else {
            const cache = JetStream.blobDataCache;
            for (const file of this.plan.files) {
                scripts.addWithURL(globalThis.prefetchResources ? cache[file].blobURL : file);
            }
        }

        const promise = new Promise((resolve, reject) => {
            currentResolve = resolve;
            currentReject = reject;
        });

        scripts.add(this.runnerCode);

        performance.mark(this.name);
        this.startTime = performance.now();

        if (RAMification)
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
        const blobData = JetStream.blobDataCache[resource];
        if (!globalThis.prefetchResources) {
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
        const blob = await response.blob();
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
        const statusElement = document.getElementById("status");
        statusElement.innerHTML = `Loading ${counter.loadedResources} of ${counter.totalResources} ...`;
    }

    prefetchResourcesForBrowser() {
        console.assert(isInBrowser);

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
        console.assert(isInBrowser);

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
        console.assert(isInBrowser);

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

    prefetchResourcesForShell() {
        console.assert(!isInBrowser);

        console.assert(this.scripts === null, "This initialization should be called only once.");
        this.scripts = this.plan.files.map(file => shellFileLoader.load(file));

        console.assert(this.preloads === null, "This initialization should be called only once.");
        this.preloads = Object.entries(this.plan.preload ?? {});
    }

    scoreIdentifiers() {
        const ids = Object.keys(this.allScores()).map(name => this.scoreIdentifier(name));
        return ids;
    }

    scoreIdentifier(scoreName) {
        return `results-cell-${this.name}-${scoreName}`;
    }

    updateUIBeforeRun() {
        if (!dumpJSONResults)
            console.log(`Running ${this.name}:`);
        if (isInBrowser)
            this.updateUIBeforeRunInBrowser();
    }

    updateUIBeforeRunInBrowser() {
        const resultsBenchmarkUI = document.getElementById(`benchmark-${this.name}`);
        resultsBenchmarkUI.classList.add("benchmark-running");
        resultsBenchmarkUI.scrollIntoView({ block: "nearest" });

        for (const id of this.scoreIdentifiers())
            document.getElementById(id).innerHTML = "...";
    }

    updateUIAfterRun() {
        const scoreEntries = Object.entries(this.allScores());
        if (isInBrowser)
            this.updateUIAfterRunInBrowser(scoreEntries);
        if (dumpJSONResults)
            return;
        this.updateConsoleAfterRun(scoreEntries);
    }

    updateUIAfterRunInBrowser(scoreEntries) {
        const benchmarkResultsUI = document.getElementById(`benchmark-${this.name}`);
        benchmarkResultsUI.classList.remove("benchmark-running");
        benchmarkResultsUI.classList.add("benchmark-done");

        for (const [name, value] of scoreEntries)
            document.getElementById(this.scoreIdentifier(name)).innerHTML = uiFriendlyScore(value);

        this.renderScatterPlot();
    }

    renderScatterPlot() {
        const plotContainer = document.getElementById(`plot-${this.name}`);
        if (!plotContainer || !this.results || this.results.length === 0)
            return;

        const scoreElement = document.getElementById(this.scoreIdentifier("Score"));
        const width = scoreElement.offsetWidth;
        const height = scoreElement.offsetHeight;

        const padding = 5;
        const maxResult = Math.max(...this.results);
        const minResult = Math.min(...this.results);

        const xRatio = (width - 2 * padding) / (this.results.length - 1 || 1);
        const yRatio = (height - 2 * padding) / (maxResult - minResult || 1);
        const radius = Math.max(1.5, Math.min(2.5, 10 - (this.iterations / 10)));

        let circlesSVG = "";
        for (let i = 0; i < this.results.length; i++) {
            const result = this.results[i];
            const cx = padding + i * xRatio;
            const cy = height - padding - (result - minResult) * yRatio;
            const title = `Iteration ${i + 1}: ${uiFriendlyDuration(result)}`;
            circlesSVG += `<circle cx="${cx}" cy="${cy}" r="${radius}"><title>${title}</title></circle>`;
        }
        plotContainer.innerHTML = `<svg width="${width}px" height="${height}px">${circlesSVG}</svg>`;
    }

    updateConsoleAfterRun(scoreEntries) {
        // FIXME: consider removing this mapping.
        // Rename for backwards compatibility.
        const legacyScoreNameMap = {
            __proto__: null,
            "First": "Startup",
            "Worst": "Worst Case",
            "MainRun": "Tests",
            "Runtime": "Run time",
        };
        for (let [name, value] of scoreEntries) {
            if (name in legacyScoreNameMap)
                name = legacyScoreNameMap[name];
             console.log(`    ${name}:`, uiFriendlyScore(value));
        }
        if (RAMification) {
            console.log("    Current Footprint:", uiFriendlyNumber(this.currentFootprint));
            console.log("    Peak Footprint:", uiFriendlyNumber(this.peakFootprint));
        }
        console.log("    Wall time:", uiFriendlyDuration(this.endTime - this.startTime));
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

    async prefetchResourcesForBrowser() {
        for (const benchmark of this.benchmarks)
            await benchmark.prefetchResourcesForBrowser();
    }

    async retryPrefetchResourcesForBrowser() {
        for (const benchmark of this.benchmarks)
            await benchmark.retryPrefetchResourcesForBrowser();
    }

    prefetchResourcesForShell() {
        for (const benchmark of this.benchmarks)
            benchmark.prefetchResourcesForShell();
    }

    get files() {
        let files = [];
        for (const benchmark of this.benchmarks)
            files = files.concat(benchmark.files);
        return files;
    }

    async run() {
        this._state = BenchmarkState.PREPARE;
        performance.mark(this.name);
        this.startTime = performance.now();

        let benchmark;
        try {
            this._state = BenchmarkState.RUNNING;
            for (benchmark of this.benchmarks)
                await benchmark.run();
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
};

class DefaultBenchmark extends Benchmark {
    constructor(...args) {
        super(...args);

        this.worstCaseCount = getWorstCaseCount(this.plan);
        this.firstIterationTime = null;
        this.firstIterationScore = null;
        this.worstTime = null;
        this.worstScore = null;
        this.averageTime = null;
        this.averageScore = null;

        console.assert(this.iterations > this.worstCaseCount);
    }

    processResults(results) {
        results = super.processResults(results)

        this.firstIterationTime = results[0];
        this.firstIterationScore = toScore(results[0]);

        results = results.slice(1);
        results.sort((a, b) => a < b ? 1 : -1);
        for (let i = 0; i + 1 < results.length; ++i)
            console.assert(results[i] >= results[i + 1]);

        const worstCase = [];
        for (let i = 0; i < this.worstCaseCount; ++i)
            worstCase.push(results[i]);
        this.worstTime = mean(worstCase);
        this.worstScore = toScore(this.worstTime);
        this.averageTime = mean(results);
        this.averageScore = toScore(this.averageTime);
    }

    subScores() {
        return {
            "First": this.firstIterationScore,
            "Worst": this.worstScore,
            "Average": this.averageScore,
        };
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
                    return new Int8Array(read(path, "binary"));
                };

                JetStream.getString = async function(path) {
                    return read(path);
                };

                JetStream.dynamicImport = async function(path) {
                    try {
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

    get runnerCode() {
        return `
        async function doRun() {
            const benchmark = new Benchmark(${this.iterations});
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
    constructor(...args) {
        super(...args);

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
            const benchmark = new Benchmark();
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

    subScores() {
        return {
            "Stdlib": this.stdlibScore,
            "MainRun": this.mainRunScore,
        };
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
            Module[key] = new Int8Array(read(path, "binary"));
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

        const keys = Object.keys(this.plan.preload);
        for (let i = 0; i < keys.length; ++i) {
            str += `JetStream.loadBlob("${keys[i]}", "${this.plan.preload[keys[i]]}", () => {\n`;
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
};

function dotnetPreloads(type)
{
    return {
        dotnetUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/dotnet.js`,
        dotnetNativeUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/dotnet.native.js`,
        dotnetRuntimeUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/dotnet.runtime.js`,
        wasmBinaryUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/dotnet.native.wasm`,
        icuCustomUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/icudt_CJK.dat`,
        dllCollectionsConcurrentUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Collections.Concurrent.wasm`,
        dllCollectionsUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Collections.wasm`,
        dllComponentModelPrimitivesUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.ComponentModel.Primitives.wasm`,
        dllComponentModelTypeConverterUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.ComponentModel.TypeConverter.wasm`,
        dllDrawingPrimitivesUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Drawing.Primitives.wasm`,
        dllDrawingUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Drawing.wasm`,
        dllIOPipelinesUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.IO.Pipelines.wasm`,
        dllLinqUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Linq.wasm`,
        dllMemoryUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Memory.wasm`,
        dllObjectModelUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.ObjectModel.wasm`,
        dllPrivateCorelibUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Private.CoreLib.wasm`,
        dllRuntimeInteropServicesJavaScriptUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Runtime.InteropServices.JavaScript.wasm`,
        dllTextEncodingsWebUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Text.Encodings.Web.wasm`,
        dllTextJsonUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/System.Text.Json.wasm`,
        dllAppUrl: `./wasm/dotnet/build-${type}/wwwroot/_framework/dotnet.wasm`,
    }
}

let BENCHMARKS = [
    // ARES
    new DefaultBenchmark({
        name: "Air",
        files: [
            "./ARES-6/Air/symbols.js",
            "./ARES-6/Air/tmp_base.js",
            "./ARES-6/Air/arg.js",
            "./ARES-6/Air/basic_block.js",
            "./ARES-6/Air/code.js",
            "./ARES-6/Air/frequented_block.js",
            "./ARES-6/Air/inst.js",
            "./ARES-6/Air/opcode.js",
            "./ARES-6/Air/reg.js",
            "./ARES-6/Air/stack_slot.js",
            "./ARES-6/Air/tmp.js",
            "./ARES-6/Air/util.js",
            "./ARES-6/Air/custom.js",
            "./ARES-6/Air/liveness.js",
            "./ARES-6/Air/insertion_set.js",
            "./ARES-6/Air/allocate_stack.js",
            "./ARES-6/Air/payload-gbemu-executeIteration.js",
            "./ARES-6/Air/payload-imaging-gaussian-blur-gaussianBlur.js",
            "./ARES-6/Air/payload-airjs-ACLj8C.js",
            "./ARES-6/Air/payload-typescript-scanIdentifier.js",
            "./ARES-6/Air/benchmark.js",
        ],
        tags: ["Default", "ARES"],
    }),
    new DefaultBenchmark({
        name: "Basic",
        files: [
            "./ARES-6/Basic/ast.js",
            "./ARES-6/Basic/basic.js",
            "./ARES-6/Basic/caseless_map.js",
            "./ARES-6/Basic/lexer.js",
            "./ARES-6/Basic/number.js",
            "./ARES-6/Basic/parser.js",
            "./ARES-6/Basic/random.js",
            "./ARES-6/Basic/state.js",
            "./ARES-6/Basic/benchmark.js",
        ],
        tags: ["Default", "ARES"],
    }),
    new DefaultBenchmark({
        name: "ML",
        files: [
            "./ARES-6/ml/index.js",
            "./ARES-6/ml/benchmark.js",
        ],
        iterations: 60,
        tags: ["Default", "ARES"],
    }),
    new AsyncBenchmark({
        name: "Babylon",
        files: [
            "./ARES-6/Babylon/index.js",
            "./ARES-6/Babylon/benchmark.js",
        ],
        preload: {
            airBlob: "./ARES-6/Babylon/air-blob.js",
            basicBlob: "./ARES-6/Babylon/basic-blob.js",
            inspectorBlob: "./ARES-6/Babylon/inspector-blob.js",
            babylonBlob: "./ARES-6/Babylon/babylon-blob.js",
        },
        tags: ["Default", "ARES"],
        allowUtf16: true,
    }),
    // CDJS
    new DefaultBenchmark({
        name: "cdjs",
        files: [
            "./cdjs/constants.js",
            "./cdjs/util.js",
            "./cdjs/red_black_tree.js",
            "./cdjs/call_sign.js",
            "./cdjs/vector_2d.js",
            "./cdjs/vector_3d.js",
            "./cdjs/motion.js",
            "./cdjs/reduce_collision_set.js",
            "./cdjs/simulator.js",
            "./cdjs/collision.js",
            "./cdjs/collision_detector.js",
            "./cdjs/benchmark.js",
        ],
        iterations: 60,
        worstCaseCount: 3,
        tags: ["Default", "CDJS"],
    }),
    // CodeLoad
    new AsyncBenchmark({
        name: "first-inspector-code-load",
        files: [
            "./code-load/code-first-load.js",
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js",
        },
        tags: ["Default", "CodeLoad"],
    }),
    new AsyncBenchmark({
        name: "multi-inspector-code-load",
        files: [
            "./code-load/code-multi-load.js",
        ],
        preload: {
            inspectorPayloadBlob: "./code-load/inspector-payload-minified.js",
        },
        tags: ["Default", "CodeLoad"],
    }),
    // Octane
    new DefaultBenchmark({
        name: "Box2D",
        files: [
            "./Octane/box2d.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "octane-code-load",
        files: [
            "./Octane/code-first-load.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "crypto",
        files: [
            "./Octane/crypto.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "delta-blue",
        files: [
            "./Octane/deltablue.js"
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "earley-boyer",
        files: [
            "./Octane/earley-boyer.js"
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "gbemu",
        files: [
            "./Octane/gbemu-part1.js",
            "./Octane/gbemu-part2.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "mandreel",
        files: [
            "./Octane/mandreel.js"
        ],
        iterations: 80,
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "navier-stokes",
        files: [
            "./Octane/navier-stokes.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "pdfjs",
        files: [
            "./Octane/pdfjs.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "raytrace",
        files: [
            "./Octane/raytrace.js",
        ],
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "regexp",
        files: [
            "./Octane/regexp.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "richards",
        files: [
            "./Octane/richards.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "splay",
        files: [
            "./Octane/splay.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    new DefaultBenchmark({
        name: "typescript",
        files: [
            "./Octane/typescript-compiler.js",
            "./Octane/typescript-input.js",
            "./Octane/typescript.js",
        ],
        iterations: 15,
        worstCaseCount: 2,
        deterministicRandom: true,
        tags: ["Default", "Octane"],
    }),
    // RexBench
    new DefaultBenchmark({
        name: "FlightPlanner",
        files: [
            "./RexBench/FlightPlanner/airways.js",
            "./RexBench/FlightPlanner/waypoints.js",
            "./RexBench/FlightPlanner/flight_planner.js",
            "./RexBench/FlightPlanner/expectations.js",
            "./RexBench/FlightPlanner/benchmark.js",
        ],
        tags: ["Default", "RexBench"],
    }),
    new DefaultBenchmark({
        name: "OfflineAssembler",
        files: [
            "./RexBench/OfflineAssembler/registers.js",
            "./RexBench/OfflineAssembler/instructions.js",
            "./RexBench/OfflineAssembler/ast.js",
            "./RexBench/OfflineAssembler/parser.js",
            "./RexBench/OfflineAssembler/file.js",
            "./RexBench/OfflineAssembler/LowLevelInterpreter.js",
            "./RexBench/OfflineAssembler/LowLevelInterpreter32_64.js",
            "./RexBench/OfflineAssembler/LowLevelInterpreter64.js",
            "./RexBench/OfflineAssembler/InitBytecodes.js",
            "./RexBench/OfflineAssembler/expected.js",
            "./RexBench/OfflineAssembler/benchmark.js",
        ],
        iterations: 80,
        tags: ["Default", "RexBench"],
    }),
    new DefaultBenchmark({
        name: "UniPoker",
        files: [
            "./RexBench/UniPoker/poker.js",
            "./RexBench/UniPoker/expected.js",
            "./RexBench/UniPoker/benchmark.js",
        ],
        deterministicRandom: true,
        // FIXME: UniPoker should not access isInBrowser.
        exposeBrowserTest: true,
        tags: ["Default", "RexBench"],
    }),
    // Simple
    new DefaultBenchmark({
        name: "hash-map",
        files: [
            "./simple/hash-map.js",
        ],
        tags: ["Default", "Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-promise",
        files: [
            "./simple/doxbee-promise.js",
        ],
        tags: ["Default", "Simple"],
    }),
    new AsyncBenchmark({
        name: "doxbee-async",
        files: [
            "./simple/doxbee-async.js",
        ],
        tags: ["Default", "Simple"],
    }),
    // SeaMonster
    new DefaultBenchmark({
        name: "ai-astar",
        files: [
            "./SeaMonster/ai-astar.js"
        ],
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "gaussian-blur",
        files: [
            "./SeaMonster/gaussian-blur.js",
        ],
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-aes",
        files: [
            "./SeaMonster/sjlc.js",
            "./SeaMonster/stanford-crypto-aes.js",
        ],
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-pbkdf2",
        files: [
            "./SeaMonster/sjlc.js",
            "./SeaMonster/stanford-crypto-pbkdf2.js"
        ],
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "stanford-crypto-sha256",
        files: [
            "./SeaMonster/sjlc.js",
            "./SeaMonster/stanford-crypto-sha256.js",
        ],
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-stringify-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js",
            "./SeaMonster/json-stringify-inspector.js",
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["Default", "SeaMonster"],
    }),
    new DefaultBenchmark({
        name: "json-parse-inspector",
        files: [
            "./SeaMonster/inspector-json-payload.js",
            "./SeaMonster/json-parse-inspector.js",
        ],
        iterations: 20,
        worstCaseCount: 2,
        tags: ["Default", "SeaMonster"],
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
        tags: ["Default", "BigIntNoble"],
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
        tags: ["Default", "Proxy"],
    }),
    new AsyncBenchmark({
        name: "proxy-vue",
        files: [
            "./proxy/common.js",
            "./proxy/vue-bundle.js",
            "./proxy/vue-benchmark.js",
        ],
        tags: ["Default", "Proxy"],
    }),
    // Class fields
    new DefaultBenchmark({
        name: "raytrace-public-class-fields",
        files: [
            "./class-fields/raytrace-public-class-fields.js",
        ],
        tags: ["Default", "ClassFields"],
    }),
    new DefaultBenchmark({
        name: "raytrace-private-class-fields",
        files: [
            "./class-fields/raytrace-private-class-fields.js",
        ],
        tags: ["Default", "ClassFields"],
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
        tags: ["Default", "Generators"],
    }),
    new DefaultBenchmark({
        name: "sync-fs",
        files: [
            "./generators/sync-file-system.js",
        ],
        iterations: 80,
        worstCaseCount: 6,
        deterministicRandom: true,
        tags: ["Default", "Generators"],
    }),
    new DefaultBenchmark({
        name: "lazy-collections",
        files: [
            "./generators/lazy-collections.js",
        ],
        tags: ["Default", "Generators"],
    }),
    new DefaultBenchmark({
        name: "js-tokens",
        files: [
            "./generators/js-tokens.js",
        ],
        tags: ["Default", "Generators"],
    }),
    new DefaultBenchmark({
        name: "threejs",
        files: [
            "./threejs/three.js",
            "./threejs/benchmark.js",
        ],
        deterministicRandom: true,
        tags: ["Default", "ThreeJs"],
    }),
    // Wasm
    new WasmEMCCBenchmark({
        name: "HashSet-wasm",
        files: [
            "./wasm/HashSet/build/HashSet.js",
            "./wasm/HashSet/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/HashSet/build/HashSet.wasm",
        },
        iterations: 50,
        // No longer run by-default: We have more realistic Wasm workloads by
        // now, and it was over-incentivizing inlining.
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "tsf-wasm",
        files: [
            "./wasm/TSF/build/tsf.js",
            "./wasm/TSF/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/TSF/build/tsf.wasm",
        },
        iterations: 50,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "quicksort-wasm",
        files: [
            "./wasm/quicksort/build/quicksort.js",
            "./wasm/quicksort/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/quicksort/build/quicksort.wasm",
        },
        iterations: 50,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "gcc-loops-wasm",
        files: [
            "./wasm/gcc-loops/build/gcc-loops.js",
            "./wasm/gcc-loops/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/gcc-loops/build/gcc-loops.wasm",
        },
        iterations: 50,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "richards-wasm",
        files: [
            "./wasm/richards/build/richards.js",
            "./wasm/richards/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/richards/build/richards.wasm",
        },
        iterations: 50,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "sqlite3-wasm",
        files: [
            "./sqlite3/benchmark.js",
            "./sqlite3/build/jswasm/speedtest1.js",
        ],
        preload: {
            wasmBinary: "./sqlite3/build/jswasm/speedtest1.wasm",
        },
        iterations: 30,
        worstCaseCount: 2,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Dart-flute-complex-wasm",
        files: [
            "./Dart/benchmark.js",
        ],
        preload: {
            jsModule: "./Dart/build/flute.complex.dart2wasm.mjs",
            wasmBinary: "./Dart/build/flute.complex.dart2wasm.wasm",
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
            "./Dart/benchmark.js",
        ],
        preload: {
            jsModule: "./Dart/build/flute.todomvc.dart2wasm.mjs",
            wasmBinary: "./Dart/build/flute.todomvc.dart2wasm.wasm",
        },
        iterations: 30,
        worstCaseCount: 2,
        tags: ["Default", "Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "Kotlin-compose-wasm",
        files: [
            "./Kotlin-compose/benchmark.js",
        ],
        preload: {
            skikoJsModule: "./Kotlin-compose/build/skiko.mjs",
            skikoWasmBinary: "./Kotlin-compose/build/skiko.wasm",
            composeJsModule: "./Kotlin-compose/build/compose-benchmarks-benchmarks.uninstantiated.mjs",
            composeWasmBinary: "./Kotlin-compose/build/compose-benchmarks-benchmarks.wasm",
            inputImageCompose: "./Kotlin-compose/build/compose-multiplatform.png",
            inputImageCat: "./Kotlin-compose/build/example1_cat.jpg",
            inputImageComposeCommunity: "./Kotlin-compose/build/example1_compose-community-primary.png",
            inputFontItalic: "./Kotlin-compose/build/jetbrainsmono_italic.ttf",
            inputFontRegular: "./Kotlin-compose/build/jetbrainsmono_regular.ttf"
        },
        iterations: 15,
        worstCaseCount: 2,
        tags: ["Default", "Wasm"],
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
            "./wasm/tfjs-benchmark.js",
        ],
        preload: {
            tfjsBackendWasmBlob: "./wasm/tfjs-backend-wasm.wasm",
        },
        async: true,
        deterministicRandom: true,
        exposeBrowserTest: true,
        allowUtf16: true,
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
            "./wasm/tfjs-benchmark.js",
        ],
        preload: {
            tfjsBackendWasmSimdBlob: "./wasm/tfjs-backend-wasm-simd.wasm",
        },
        async: true,
        deterministicRandom: true,
        exposeBrowserTest: true,
        allowUtf16: true,
        tags: ["Wasm"],
    }),
    new WasmEMCCBenchmark({
        name: "argon2-wasm",
        files: [
            "./wasm/argon2/build/argon2.js",
            "./wasm/argon2/benchmark.js",
        ],
        preload: {
            wasmBinary: "./wasm/argon2/build/argon2.wasm",
        },
        iterations: 30,
        worstCaseCount: 3,
        deterministicRandom: true,
        allowUtf16: true,
        tags: ["Default", "Wasm"],
    }),
    // WorkerTests
    new AsyncBenchmark({
        name: "bomb-workers",
        files: [
            "./worker/bomb.js",
        ],
        exposeBrowserTest: true,
        iterations: 80,
        preload: {
            rayTrace3D: "./worker/bomb-subtests/3d-raytrace.js",
            accessNbody: "./worker/bomb-subtests/access-nbody.js",
            morph3D: "./worker/bomb-subtests/3d-morph.js",
            cube3D: "./worker/bomb-subtests/3d-cube.js",
            accessFunnkuch: "./worker/bomb-subtests/access-fannkuch.js",
            accessBinaryTrees: "./worker/bomb-subtests/access-binary-trees.js",
            accessNsieve: "./worker/bomb-subtests/access-nsieve.js",
            bitopsBitwiseAnd: "./worker/bomb-subtests/bitops-bitwise-and.js",
            bitopsNsieveBits: "./worker/bomb-subtests/bitops-nsieve-bits.js",
            controlflowRecursive: "./worker/bomb-subtests/controlflow-recursive.js",
            bitops3BitBitsInByte: "./worker/bomb-subtests/bitops-3bit-bits-in-byte.js",
            botopsBitsInByte: "./worker/bomb-subtests/bitops-bits-in-byte.js",
            cryptoAES: "./worker/bomb-subtests/crypto-aes.js",
            cryptoMD5: "./worker/bomb-subtests/crypto-md5.js",
            cryptoSHA1: "./worker/bomb-subtests/crypto-sha1.js",
            dateFormatTofte: "./worker/bomb-subtests/date-format-tofte.js",
            dateFormatXparb: "./worker/bomb-subtests/date-format-xparb.js",
            mathCordic: "./worker/bomb-subtests/math-cordic.js",
            mathPartialSums: "./worker/bomb-subtests/math-partial-sums.js",
            mathSpectralNorm: "./worker/bomb-subtests/math-spectral-norm.js",
            stringBase64: "./worker/bomb-subtests/string-base64.js",
            stringFasta: "./worker/bomb-subtests/string-fasta.js",
            stringValidateInput: "./worker/bomb-subtests/string-validate-input.js",
            stringTagcloud: "./worker/bomb-subtests/string-tagcloud.js",
            stringUnpackCode: "./worker/bomb-subtests/string-unpack-code.js",
            regexpDNA: "./worker/bomb-subtests/regexp-dna.js",
        },
        tags: ["Default", "WorkerTests"],
    }),
    new AsyncBenchmark({
        name: "segmentation",
        files: [
            "./worker/segmentation.js",
        ],
        preload: {
            asyncTaskBlob: "./worker/async-task.js",
        },
        iterations: 36,
        worstCaseCount: 3,
        tags: ["Default", "WorkerTests"],
    }),
    // WSL
    new WSLBenchmark({
        name: "WSL",
        files: [
            "./WSL/Node.js",
            "./WSL/Type.js",
            "./WSL/ReferenceType.js",
            "./WSL/Value.js",
            "./WSL/Expression.js",
            "./WSL/Rewriter.js",
            "./WSL/Visitor.js",
            "./WSL/CreateLiteral.js",
            "./WSL/CreateLiteralType.js",
            "./WSL/PropertyAccessExpression.js",
            "./WSL/AddressSpace.js",
            "./WSL/AnonymousVariable.js",
            "./WSL/ArrayRefType.js",
            "./WSL/ArrayType.js",
            "./WSL/Assignment.js",
            "./WSL/AutoWrapper.js",
            "./WSL/Block.js",
            "./WSL/BoolLiteral.js",
            "./WSL/Break.js",
            "./WSL/CallExpression.js",
            "./WSL/CallFunction.js",
            "./WSL/Check.js",
            "./WSL/CheckLiteralTypes.js",
            "./WSL/CheckLoops.js",
            "./WSL/CheckRecursiveTypes.js",
            "./WSL/CheckRecursion.js",
            "./WSL/CheckReturns.js",
            "./WSL/CheckUnreachableCode.js",
            "./WSL/CheckWrapped.js",
            "./WSL/Checker.js",
            "./WSL/CloneProgram.js",
            "./WSL/CommaExpression.js",
            "./WSL/ConstexprFolder.js",
            "./WSL/ConstexprTypeParameter.js",
            "./WSL/Continue.js",
            "./WSL/ConvertPtrToArrayRefExpression.js",
            "./WSL/DereferenceExpression.js",
            "./WSL/DoWhileLoop.js",
            "./WSL/DotExpression.js",
            "./WSL/DoubleLiteral.js",
            "./WSL/DoubleLiteralType.js",
            "./WSL/EArrayRef.js",
            "./WSL/EBuffer.js",
            "./WSL/EBufferBuilder.js",
            "./WSL/EPtr.js",
            "./WSL/EnumLiteral.js",
            "./WSL/EnumMember.js",
            "./WSL/EnumType.js",
            "./WSL/EvaluationCommon.js",
            "./WSL/Evaluator.js",
            "./WSL/ExpressionFinder.js",
            "./WSL/ExternalOrigin.js",
            "./WSL/Field.js",
            "./WSL/FindHighZombies.js",
            "./WSL/FlattenProtocolExtends.js",
            "./WSL/FlattenedStructOffsetGatherer.js",
            "./WSL/FloatLiteral.js",
            "./WSL/FloatLiteralType.js",
            "./WSL/FoldConstexprs.js",
            "./WSL/ForLoop.js",
            "./WSL/Func.js",
            "./WSL/FuncDef.js",
            "./WSL/FuncInstantiator.js",
            "./WSL/FuncParameter.js",
            "./WSL/FunctionLikeBlock.js",
            "./WSL/HighZombieFinder.js",
            "./WSL/IdentityExpression.js",
            "./WSL/IfStatement.js",
            "./WSL/IndexExpression.js",
            "./WSL/InferTypesForCall.js",
            "./WSL/Inline.js",
            "./WSL/Inliner.js",
            "./WSL/InstantiateImmediates.js",
            "./WSL/IntLiteral.js",
            "./WSL/IntLiteralType.js",
            "./WSL/Intrinsics.js",
            "./WSL/LateChecker.js",
            "./WSL/Lexer.js",
            "./WSL/LexerToken.js",
            "./WSL/LiteralTypeChecker.js",
            "./WSL/LogicalExpression.js",
            "./WSL/LogicalNot.js",
            "./WSL/LoopChecker.js",
            "./WSL/MakeArrayRefExpression.js",
            "./WSL/MakePtrExpression.js",
            "./WSL/NameContext.js",
            "./WSL/NameFinder.js",
            "./WSL/NameResolver.js",
            "./WSL/NativeFunc.js",
            "./WSL/NativeFuncInstance.js",
            "./WSL/NativeType.js",
            "./WSL/NativeTypeInstance.js",
            "./WSL/NormalUsePropertyResolver.js",
            "./WSL/NullLiteral.js",
            "./WSL/NullType.js",
            "./WSL/OriginKind.js",
            "./WSL/OverloadResolutionFailure.js",
            "./WSL/Parse.js",
            "./WSL/Prepare.js",
            "./WSL/Program.js",
            "./WSL/ProgramWithUnnecessaryThingsRemoved.js",
            "./WSL/PropertyResolver.js",
            "./WSL/Protocol.js",
            "./WSL/ProtocolDecl.js",
            "./WSL/ProtocolFuncDecl.js",
            "./WSL/ProtocolRef.js",
            "./WSL/PtrType.js",
            "./WSL/ReadModifyWriteExpression.js",
            "./WSL/RecursionChecker.js",
            "./WSL/RecursiveTypeChecker.js",
            "./WSL/ResolveNames.js",
            "./WSL/ResolveOverloadImpl.js",
            "./WSL/ResolveProperties.js",
            "./WSL/ResolveTypeDefs.js",
            "./WSL/Return.js",
            "./WSL/ReturnChecker.js",
            "./WSL/ReturnException.js",
            "./WSL/StandardLibrary.js",
            "./WSL/StatementCloner.js",
            "./WSL/StructLayoutBuilder.js",
            "./WSL/StructType.js",
            "./WSL/Substitution.js",
            "./WSL/SwitchCase.js",
            "./WSL/SwitchStatement.js",
            "./WSL/SynthesizeEnumFunctions.js",
            "./WSL/SynthesizeStructAccessors.js",
            "./WSL/TrapStatement.js",
            "./WSL/TypeDef.js",
            "./WSL/TypeDefResolver.js",
            "./WSL/TypeOrVariableRef.js",
            "./WSL/TypeParameterRewriter.js",
            "./WSL/TypeRef.js",
            "./WSL/TypeVariable.js",
            "./WSL/TypeVariableTracker.js",
            "./WSL/TypedValue.js",
            "./WSL/UintLiteral.js",
            "./WSL/UintLiteralType.js",
            "./WSL/UnificationContext.js",
            "./WSL/UnreachableCodeChecker.js",
            "./WSL/VariableDecl.js",
            "./WSL/VariableRef.js",
            "./WSL/VisitingSet.js",
            "./WSL/WSyntaxError.js",
            "./WSL/WTrapError.js",
            "./WSL/WTypeError.js",
            "./WSL/WhileLoop.js",
            "./WSL/WrapChecker.js",
            "./WSL/Test.js",
        ],
        tags: ["Default", "WSL"],
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
            romBinary: "./8bitbench/build/assets/program.bin",
        },
        iterations: 15,
        worstCaseCount: 2,
        tags: ["Default", "Wasm"],
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
        tags: ["Default", "Wasm"],
    }),
    // .NET
    new AsyncBenchmark({
        name: "dotnet-interp-wasm",
        files: [
            "./wasm/dotnet/interp.js",
            "./wasm/dotnet/benchmark.js",
        ],
        preload: dotnetPreloads("interp"),
        iterations: 10,
        worstCaseCount: 2,
        tags: ["Default", "Wasm", "dotnet"],
    }),
    new AsyncBenchmark({
        name: "dotnet-aot-wasm",
        files: [
            "./wasm/dotnet/aot.js",
            "./wasm/dotnet/benchmark.js",
        ],
        preload: dotnetPreloads("aot"),
        iterations: 15,
        worstCaseCount: 2,
        tags: ["Default", "Wasm", "dotnet"],
    })
];


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
            `./SunSpider/${test}.js`
        ],
        tags: [],
    }));
}
BENCHMARKS.push(new GroupedBenchmark({
    name: "Sunspider",
    tags: ["Default", "SunSpider"],
}, SUNSPIDER_BENCHMARKS))

// WTB (Web Tooling Benchmark) tests
const WTB_TESTS = [
    "acorn",
    "babylon",
    "chai",
    "coffeescript",
    "espree",
    "jshint",
    "lebab",
    "prepack",
    "uglify-js",
];
for (const name of WTB_TESTS) {
    BENCHMARKS.push(new DefaultBenchmark({
        name: `${name}-wtb`,
        files: [
            (isInBrowser ? "./web-tooling-benchmark/browser.js" : "./web-tooling-benchmark/cli.js"),
            `./web-tooling-benchmark/${name}.js`,
        ],
        iterations: 5,
        worstCaseCount: 1,
        allowUtf16: true,
        tags: ["Default", "WTB"],
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

if (globalThis.testList?.length) {
    benchmarks = processTestList(globalThis.testList);
} else {
    benchmarks = findBenchmarksByTag("Default", defaultDisabledTags)
}

this.JetStream = new Driver(benchmarks);
