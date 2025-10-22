#! /usr/bin/env node
/* eslint-disable-next-line  no-unused-vars */

// Copyright (C) 2007-2025 Apple Inc. All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//  notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//  notice, this list of conditions and the following disclaimer in the
//  documentation and/or other materials provided with the distribution.

// THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
// BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
// THE POSSIBILITY OF SUCH DAMAGE.

import serve from "./server.mjs";
import { Builder, Capabilities, logging } from "selenium-webdriver";
import commandLineArgs from "command-line-args";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

import {logInfo, logError, printHelp, runTest} from "./helper.mjs";

const optionDefinitions = [
    { name: "browser", type: String, description: "Set the browser to test, choices are [safari, firefox, chrome, edge]. By default the $BROWSER env variable is used." },
    { name: "port", type: Number, defaultValue: 8010, description: "Set the test-server port, The default value is 8010." },
    { name: "help", alias: "h", description: "Print this help text." },
];

const options = commandLineArgs(optionDefinitions);

if ("help" in options)
    printHelp(optionDefinitions);

const BROWSER = options?.browser;
if (!BROWSER)
    printHelp("No browser specified, use $BROWSER or --browser", optionDefinitions);

let capabilities;
switch (BROWSER) {
    case "safari":
        capabilities = Capabilities.safari();
        capabilities.set("safari:diagnose", true);
        break;

    case "firefox": {
        capabilities = Capabilities.firefox();
        break;
    }
    case "chrome": {
        capabilities = Capabilities.chrome();
        break;
    }
    case "edge": {
        capabilities = Capabilities.edge();
        break;
    }
    default: {
        printHelp(`Invalid browser "${BROWSER}", choices are: "safari", "firefox", "chrome", "edge"`);
    }
}

process.on("unhandledRejection", (err) => {
    logError(err);
    process.exit(1);
});
process.once("uncaughtException", (err) => {
    logError(err);
    process.exit(1);
});

const PORT = options.port;
const server = await serve(PORT);

async function runTests() {
    let success = true;
    try {
        success &&= await runEnd2EndTest("Run Single Suite", { test: "proxy-mobx" });
        success &&= await runEnd2EndTest("Run Multiple Suites", { test: "prismjs-startup-es6,postcss-wtb" });
        success &&= await runEnd2EndTest("Run Tag No Prefetch",  { tag: "proxy", prefetchResources: "false" });
        success &&= await runEnd2EndTest("Run Disabled Suite", { tag: "disabled" });
        success &&= await runEnd2EndTest("Run Default Suite");
    } finally {
        server.close();
    }
    if (!success)
      process.exit(1);
}

async function runEnd2EndTest(name, params) {
    return runTest(name, () => testEnd2End(params));
}

async function testEnd2End(params) {
    const driver = await new Builder().withCapabilities(capabilities).build();
    const sessionId = (await driver.getSession()).getId();
    const driverCapabilities = await driver.getCapabilities();
    logInfo(`Browser: ${driverCapabilities.getBrowserName()} ${driverCapabilities.getBrowserVersion()}`);
    const urlParams = Object.assign({
            worstCaseCount: 2,
            iterationCount: 3 
        }, params);
    let results;
    let success = true;
    try {
        const url = new URL(`http://localhost:${PORT}/index.html`);
        url.search = new URLSearchParams(urlParams).toString();
        logInfo(`JetStream PREPARE ${url}`);
        await driver.get(url.toString());
        await driver.executeAsyncScript((callback) => {
            // callback() is explicitly called without the default event
            // as argument to avoid serialization issues with chromedriver.
            globalThis.addEventListener("JetStreamReady", () => callback());
            // We might not get a chance to install the on-ready listener, thus
            // we also check if the runner is ready synchronously.
            if (globalThis?.JetStream?.isReady)
                callback();
        });
        results = await benchmarkResults(driver);
        // FIXME: validate results;
    } catch(e) {
        success = false;
        throw e;
    } finally {
        await driver.quit();
        if (!success) {
            await printLogs(sessionId);
        }
    }
}

async function benchmarkResults(driver) {
    logInfo("JetStream START");
    await driver.manage().setTimeouts({ script: 2 * 60_000 });
    await driver.executeAsyncScript((callback) => {
        globalThis.JetStream.start();
        callback();
    });

    await new Promise((resolve, reject) => pollResultsUntilDone(driver, resolve, reject));
    const resultsJSON = await driver.executeScript(() => {
        return globalThis.JetStream.resultsJSON();
    });
    return JSON.parse(resultsJSON);
}

class JetStreamTestError extends Error {
    constructor(errors) {
        super(`Tests failed: ${errors.map(e => e.stack).join(", ")}`);
        this.errors = errors;
    }
}

const UPDATE_INTERVAL = 250;
async function pollResultsUntilDone(driver, resolve, reject) {
    const previousResults = new Set();
    const intervalId = setInterval(async function logResult()  {
        const {done, errors, resultsJSON} = await driver.executeScript(() => {
            return {
                done: globalThis.JetStream.isDone,
                errors: globalThis.JetStream.errors,
                resultsJSON: JSON.stringify(globalThis.JetStream.resultsObject("simple")),
            };
        });
        if (errors.length) {
            clearInterval(intervalId);
            reject(new JetStreamTestError(errors));
        }
        logIncrementalResult(previousResults, JSON.parse(resultsJSON));
        if (done) {
            clearInterval(intervalId);
            resolve();
        }
    }, UPDATE_INTERVAL)
}

function logIncrementalResult(previousResults, benchmarkResults) {
    for (const [testName, testResults] of Object.entries(benchmarkResults)) {
        if (previousResults.has(testName))
            continue;
        console.log(testName, testResults);
        previousResults.add(testName);
    }
}

function printLogs(sessionId) {
    if (BROWSER === "safari" && sessionId)
        return printSafariLogs(sessionId);
}

async function printSafariLogs(sessionId) {
    const sessionLogDir = path.join(os.homedir(), "Library", "Logs", "com.apple.WebDriver", sessionId);
    try {
        const files = await fs.readdir(sessionLogDir);
        const logFiles = files.filter(f => f.startsWith("safaridriver.") && f.endsWith(".txt"));
        if (logFiles.length === 0) {
            logInfo(`No safaridriver log files found in session directory: ${sessionLogDir}`);
            return;
        }
        for (const file of logFiles) {
            const logPath = path.join(sessionLogDir, file);
            const logContent = await fs.readFile(logPath, "utf8");
            logGroup(`SafariDriver Log: ${file}`, () => console.log(logContent));
        }
    } catch (err) {
        logError("Error reading SafariDriver logs:", err);
    }
}

setImmediate(runTests);
