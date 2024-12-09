#! /usr/bin/env node
/* eslint-disable-next-line  no-unused-vars */
import serve from "./server.mjs";
import { Builder, Capabilities } from "selenium-webdriver";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import assert from "assert";

const optionDefinitions = [
    { name: "browser", type: String, description: "Set the browser to test, choices are [safari, firefox, chrome]. By default the $BROWSER env variable is used." },
    { name: "port", type: Number, defaultValue: 8010, description: "Set the test-server port, The default value is 8010." },
    { name: "help", alias: "h", description: "Print this help text." },
];

function printHelp(message = "") {
    const usage = commandLineUsage([
        {
            header: "Run all tests",
        },
        {
            header: "Options",
            optionList: optionDefinitions,
        },
    ]);
    if (!message) {
        console.log(usage);
        process.exit(0);
    } else {
        console.error(message);
        console.error();
        console.error(usage);
        process.exit(1);
    }
}

const options = commandLineArgs(optionDefinitions);

if ("help" in options)
    printHelp();

const BROWSER = options?.browser;
if (!BROWSER)
    printHelp("No browser specified, use $BROWSER or --browser");

let capabilities;
switch (BROWSER) {
    case "safari":
        capabilities = Capabilities.safari();
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
    console.error(err);
    process.exit(1);
});
process.once("uncaughtException", (err) => {
    console.error(err);
    process.exit(1);
});

const PORT = options.port;
const server = serve(PORT);

async function testEnd2End() {
    const driver = await new Builder().withCapabilities(capabilities).build();
    let results;
    try {
        await driver.get(`http://localhost:${PORT}/index.html?worstCaseCount=2&iterationCount=3`);
        await driver.executeAsyncScript((callback) => {
            globalThis.addEventListener("JetStreamReady", callback);
            // We might not get a chance to install the on-ready listener, thus
            // we also check if the runner is ready synchronously.
            if (globalThis?.JetStream?.isReady)
                callback()
        });
        await driver.manage().setTimeouts({ script: 60_000 });
        results = await driver.executeAsyncScript((callback) => {
            globalThis.addEventListener("JetStreamDone", event => callback(event.detail));
            JetStream.start();
        });
    } finally {
        console.log("\nTests complete!");
        console.log(results)
        driver.quit();
        server.close();
    }
}

setImmediate(testEnd2End);
