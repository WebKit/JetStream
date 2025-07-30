#! /usr/bin/env node
/* eslint-disable-next-line  no-unused-vars */
import serve from "./server.mjs";
import { Builder, Capabilities } from "selenium-webdriver";
import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";

const optionDefinitions = [
    { name: "browser", type: String, description: "Set the browser to test, choices are [safari, firefox, chrome, edge]. By default the $BROWSER env variable is used." },
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
const server = await serve(PORT);

async function testEnd2End() {
    const driver = await new Builder().withCapabilities(capabilities).build();
    let results;
    try {
        const url = `http://localhost:${PORT}/index.html?worstCaseCount=2&iterationCount=3`;
        console.log(`JetStream PREPARE ${url}`);
        await driver.get(url);
        await driver.executeAsyncScript((callback) => {
            // callback() is explicitly called without the default event
            // as argument to avoid serialization issues with chromedriver.
            globalThis.addEventListener("JetStreamReady", () => callback());
            // We might not get a chance to install the on-ready listener, thus
            // we also check if the runner is ready synchronously.
            if (globalThis?.JetStream?.isReady)
                callback()
        });
        results = await benchmarkResults(driver);
        // FIXME: validate results;
        console.log("\n✅ Tests completed!");
    } catch(e) {
        console.error("\n❌ Tests failed!");
        console.error(e);
        throw e;
    } finally {
        driver.quit();
        server.close();
    }
}

async function benchmarkResults(driver) {
    console.log("JetStream START");
    await driver.manage().setTimeouts({ script: 60_000 });
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
        super(`Tests failed: ${errors.map(e => e.name).join(", ")}`);
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

setImmediate(testEnd2End);
