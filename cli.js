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

load("./shell-config.js")

const cliFlags = { __proto__: null };
const cliArgs = [];
if (globalThis.arguments?.length) {
    for (const argument of globalThis.arguments)
        if (argument.startsWith("--")) {
            const parts = argument.split("=");
            cliFlags[parts[0].toLowerCase()] = parts.slice(1).join("=");
        } else
            cliArgs.push(argument);
}

function getIntFlag(flags, flag) {
    if (!(flag in flags))
        return undefined;
    const rawValue = flags[flag];
    const value = parseInt(rawValue);
    if (value <= 0)
        throw new Error(`Expected positive value for ${flag}, but got ${rawValue}`);
    return value;
}

if ("--iteration-count" in cliFlags)
    globalThis.testIterationCount = getIntFlag(cliFlags, "--iteration-count");
if ("--worst-case-count" in cliFlags)
    globalThis.testWorstCaseCount = getIntFlag(cliFlags, "--worst-case-count");
if ("--dump-json-results" in cliFlags)
    globalThis.dumpJSONResults = true;
if (typeof runMode !== "undefined" && runMode == "RAMification")
    globalThis.RAMification = true;
if ("--ramification" in cliFlags)
    globalThis.RAMification = true;
if ("--no-prefetch" in cliFlags)
    globalThis.prefetchResources = false;
if (cliArgs.length)
    globalThis.testList = cliArgs;


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

load("./JetStreamDriver.js");

if ("--help" in cliFlags) {
    console.log("JetStream Driver Help");
    console.log("");

    console.log("Options:");
    console.log("   --iteration-count:   Set the default iteration count.");
    console.log("   --worst-case-count:  Set the default worst-case count");
    console.log("   --dump-json-results: Print summary json to the console.");
    console.log("   --dump-test-list:    Print test list instead of running.");
    console.log("   --ramification:      Enable ramification support. See RAMification.py for more details.");
    console.log("   --no-prefetch:       Do not prefetch resources. Will add network overhead to measurements!");
    console.log("");

    console.log("Available tags:");
    const tagNames = Array.from(benchmarksByTag.keys()).sort();
    for (const tagName of tagNames)
        console.log("  ", tagName);
    console.log("");

    console.log("Available tests:");
    const benchmarkNames = BENCHMARKS.map(b => b.name).sort();
    for (const benchmark of benchmarkNames)
        console.log("  ", benchmark);
} else if ("--dump-test-list" in cliFlags) {
    JetStream.dumpTestList();
} else {
    runJetStream();
}
