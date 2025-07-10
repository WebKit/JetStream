/*
 * Copyright (C) 2018 Apple Inc. All rights reserved.
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

globalThis.prefetchResources = true;
const isInBrowser = false;
console = {
    log: globalThis?.console?.log ?? print,
    warn: globalThis?.console?.warn ?? print,
    error: globalThis?.console?.error ?? print,
}

const isD8 = typeof Realm !== "undefined";
if (isD8)
    globalThis.readFile = read;
const isSpiderMonkey = typeof newGlobal !== "undefined";
if (isSpiderMonkey)
    globalThis.readFile = readRelativeToScript;


let cliFlags = {};
let cliArgs = [];

if (typeof arguments != "undefined" && arguments.length > 0) {
    for (const arg of arguments) {
        if (arg.startsWith("--")) {
            const parts = arg.split("=");
            cliFlags[parts[0]] = parts.slice(1).join("=");
        } else {
            cliArgs.push(arg);
        }
    }
}

if (typeof testList === "undefined") {
    if (cliArgs.length > 0) {
        testList = cliArgs;
    } else {
        testList = undefined;
    }
}

if ("--no-prefetch" in cliFlags || "--noprefetch" in cliFlags)
   globalThis.prefetchResources = false


if (typeof testIterationCount === "undefined")
    testIterationCount = undefined;

if (typeof runMode !== "undefined" && runMode == "RAMification")
    RAMification = true;
else
    RAMification = false;

load("./JetStreamDriver.js");

if ("--help" in cliFlags) {
    print("JetStream Driver Help")
    print("")
    print("Options:")
    print("   --no-prefetch: directly use load('...') for benchmark resources.")
    print("")
    print("Available tests:")
    for (const test of testPlans)
        print("  ", test.name)
} else {
    print("Running tests: " + testList)
    runJetStream();
}

async function runJetStream() {
    try {
        await JetStream.initialize();
        await JetStream.start();
    } catch (e) {
        console.error("JetStream3 failed: " + e);
        console.error(e.stack);
        throw e;
    }
}
