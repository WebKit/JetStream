#! /usr/bin/env node

import commandLineArgs from "command-line-args";
import { spawn } from  "child_process";
import { fileURLToPath } from "url";
import { styleText } from "node:util";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import core from "@actions/core";

import {logInfo, logError, logGroup, printHelp, runTest, GITHUB_ACTIONS_OUTPUT} from "./helper.mjs";

const optionDefinitions = [
  { name: "shell", type: String, description: "Set the shell to test, choices are [jsc, v8, spidermonkey]." },
  { name: "help", alias: "h", description: "Print this help text." },
];

const options = commandLineArgs(optionDefinitions);

if ("help" in options)
  printHelp(optionDefinitions);

const JS_SHELL= options?.shell;
if (!JS_SHELL)
  printHelp("No javascript shell specified, use --shell", optionDefinitions);

const SHELL_NAME = (function() {
  switch (JS_SHELL) {
      case "javascriptcore":
      case "jsc": {
          return "javascriptcore";
    }
      case "spidermonkey": {
          return "spidermonkey";
      }
      case "v8": {
          return "v8";
      }
      default: {
          printHelp(`Invalid shell "${JS_SHELL}", choices are: "jsc", "spidermonkey" and "v8)`);
      }
  }
})();

const FILE_PATH = fileURLToPath(import.meta.url);
const SRC_DIR = path.dirname(path.dirname(FILE_PATH));
const CLI_PATH = path.join(SRC_DIR, "cli.js");
const UNIT_TEST_PATH = path.join(SRC_DIR, "tests", "unit-tests.js");

function convertCliArgs(cli, ...cliArgs) {
  if (SHELL_NAME == "spidermonkey")
    return [cli, ...cliArgs];
  return [cli, "--", ...cliArgs];
}


const SPAWN_OPTIONS =  { 
  stdio: ["inherit", "inherit", "inherit"]
};

async function sh(binary, ...args) {
  const cmd = `${binary} ${args.join(" ")}`;
  if (GITHUB_ACTIONS_OUTPUT) {
    core.startGroup(binary);
    core.notice(styleText("blue", cmd));
  } else {
    console.log(styleText("blue", cmd));
  }
  try {
    const result = await spawnCaptureStdout(binary, args, SPAWN_OPTIONS);
    if (result.status || result.error) {
      logError(result.error);
      throw new Error(`Shell CMD failed: ${binary} ${args.join(" ")}`);
    }
    return result;
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup();
  }
}

async function spawnCaptureStdout(binary, args) {
  const childProcess = spawn(binary, args);
  childProcess.stdout.pipe(process.stdout);
  return new Promise((resolve, reject) => {
    childProcess.stdoutString = "";
    childProcess.stdio[1].on("data", (data) => {
      childProcess.stdoutString += data.toString();
    });
    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve(childProcess);
      } else {
        // Reject the Promise with an Error on failure
        const error = new Error(`Command failed with exit code ${code}: ${binary} ${args.join(" ")}`);
        error.process = childProcess;
        error.stdout = childProcess.stdoutString;
        error.exitCode = code;
        reject(error);
      }
    });
    childProcess.on('error', reject);
  })
}

async function runTests() {
    const shellBinary = await logGroup(`Installing JavaScript Shell: ${SHELL_NAME}`, testSetup);
    let success = true;
    success &&= await runTest("Run UnitTests", () => sh(shellBinary, UNIT_TEST_PATH));
    success &&= await runCLITest("Run Single Suite", shellBinary, "proxy-mobx");
    success &&= await runCLITest("Run Tag No Prefetch", shellBinary, "proxy", "--no-prefetch");
    success &&= await runCLITest("Run Disabled Suite", shellBinary, "disabled");
    success &&= await runCLITest("Run Default Suite",  shellBinary);
    if (!success)
      process.exit(1);
}

function jsvuOSName() {
  const osName = () => {
      switch (os.platform()) {
          case "win32": return "win";
          case "darwin": return "mac";
          case "linux": return "linux";
          default: throw new Error("Unsupported OS");
      }
  };
  const osArch = () => {
      switch (os.arch()) {
          case "x64": return "64";
          case "arm64": return "64arm";
          default: throw new Error("Unsupported architecture");
      }
  };
  return `${osName()}${osArch()}`;
}

const DEFAULT_JSC_LOCATION = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

async function testSetup() {
    await sh("jsvu", `--engines=${SHELL_NAME}`, `--os=${jsvuOSName()}`);
    let shellBinary = path.join(os.homedir(), ".jsvu/bin", SHELL_NAME);
    if (!fs.existsSync(shellBinary) && SHELL_NAME == "javascriptcore")
      shellBinary = DEFAULT_JSC_LOCATION;
    if (!fs.existsSync(shellBinary))
      throw new Error(`Could not find shell binary: ${shellBinary}`);
    logInfo(`Installed JavaScript Shell: ${shellBinary}`);
    return shellBinary;
}

function runCLITest(name, shellBinary, ...args) {
  return runTest(name, () => runShell(shellBinary, ...convertCliArgs(CLI_PATH, ...args)));
}

async function runShell(shellBinary, ...args) {
  const result = await sh(shellBinary, ...args);
  if (result.stdoutString.includes("JetStream3 failed"))
    throw new Error("test failed")
}

setImmediate(runTests);
