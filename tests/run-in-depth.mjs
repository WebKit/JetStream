/*
 * Copyright (C) 2026 Apple Inc. All rights reserved.
 * Copyright 2026 Google LLC
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

import { JSDOM } from "jsdom";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import vm from "vm";
import { logInfo, logError, runTest } from "./helper.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

async function setUp() {
    logInfo("Loading resources...");
    // 1. Parse in-depth.html
    const inDepthHtmlPath = path.join(rootDir, "in-depth.html");
    const inDepthHtml = fs.readFileSync(inDepthHtmlPath, "utf8");
    const dom = new JSDOM(inDepthHtml);
    const document = dom.window.document;

    const paramsJsPath = path.join(rootDir, "utils", "params.js");
    const paramsJs = fs.readFileSync(paramsJsPath, "utf8");
    const driverJsPath = path.join(rootDir, "JetStreamDriver.js");
    const driverJs = fs.readFileSync(driverJsPath, "utf8");

    const sandbox = {
        isInBrowser: true,
        isD8: false,
        isSpiderMonkey: false,
        console: console,
        performance: performance,
        URLSearchParams: URLSearchParams,
        document: {
            onkeydown: null,
            body: {
                classList: {
                    add: () => {},
                },
            },
        },
        // Mock JetStreamParamsSource to load all benchmarks
        JetStreamParamsSource: new URLSearchParams("tags=all"),
        JetStream: null,
    };
    sandbox.globalThis = sandbox;
    sandbox.window = sandbox;
    sandbox.self = sandbox;

    const context = vm.createContext(sandbox);

    // Append assignment to globalThis so it's visible to the next script
    vm.runInContext(paramsJs + "; globalThis.JetStreamParams = JetStreamParams;", context);
    vm.runInContext(driverJs, context);

    if (!sandbox.JetStream || !sandbox.JetStream.benchmarks) {
        logError("Failed to initialize JetStream driver or find benchmarks.");
        throw new Error("Failed to initialize JetStream driver");
    }
    const definedBenchmarks = sandbox.JetStream.benchmarks;
    const dtElements = document.querySelectorAll("#workload-details dt[id]");
    const inDepthBenchmarks = new Set();
    dtElements.forEach((dt) => {
        inDepthBenchmarks.add(dt.id);
    });
    return { document, definedBenchmarks, inDepthBenchmarks };
}

function checkHasAnyBenchmarks({ definedBenchmarks }) {
    if (definedBenchmarks.length == 0) {
        throw new Error("No benchmarks defined");
    }
}

function checkBenchmarkDocExists({ definedBenchmarks, inDepthBenchmarks }) {
    let errors = [];
    definedBenchmarks.forEach((benchmark) => {
        if (!inDepthBenchmarks.has(benchmark.name)) {
            errors.push(
                `Benchmark '${benchmark.name}' is defined in JetStreamDriver.js but missing in in-depth.html`
            );
        }
    });
    checkValidationErrors(errors);
}

function checkDocBenchmarksExist({ inDepthBenchmarks, definedBenchmarks }) {
    let errors = [];
    inDepthBenchmarks.forEach((name) => {
        const found = definedBenchmarks.find((b) => b.name === name);
        if (!found) {
            errors.push(
                `Benchmark '${name}' is listed in in-depth.html but not defined in JetStreamDriver.js`
            );
        }
    });
    checkValidationErrors(errors);
}

async function checkRelativeLinks({ document }) {
    let errors = [];
    const ddElements = document.querySelectorAll("#workload-details dd");
    ddElements.forEach((dd) => {
        const links = dd.querySelectorAll("a[href]");
        links.forEach((link) => {
            const href = link.getAttribute("href");
            if (href.startsWith("http")) {
                return;
            }
            const filePath = path.join(rootDir, href);
            if (!fs.existsSync(filePath)) {
                errors.push(
                    `Broken link in in-depth.html: '${href}' (resolved to '${filePath}') does not exist.`
                );
            }
        });
    });
    checkValidationErrors(errors);
}

function checkValidationErrors(errors) {
    if (errors.length > 0) {
        logError("\nValidation Failed:");
        errors.forEach((err) => logError(`- ${err}`));
        throw new Error("Validation Failed");
    }
}

const data = await setUp();
let success = true;

success &&= await runTest("Has benchmarks", () => checkHasAnyBenchmarks(data));
success &&= await runTest("Check defined benchmarks are in in-depth.html", () => {
    checkBenchmarkDocExists(data);
});

success &&= await runTest("Check in-depth.html benchmarks are defined", () => {
    checkDocBenchmarksExist(data);
});

success &&= await runTest("Checking relative links in <dd> sections...", () => {
    return checkRelativeLinks(data);
});

process.exit(success ? 0 : 1);
