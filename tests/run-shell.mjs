#! /usr/bin/env node

import commandLineArgs from "command-line-args";
import commandLineUsage from "command-line-usage";
import { spawnSync } from  "child_process";
import { fileURLToPath } from "url";
import { styleText } from "node:util";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import core from "@actions/core"

const optionDefinitions = [
  { name: "shell", type: String, description: "Set the shell to test, choices are [jsc, v8, spidermonkey]." },
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

const JS_SHELL= options?.shell;
if (!JS_SHELL)
  printHelp("No javascript shell specified, use --shell");

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
    return [cli, ...cliArgs]
  return [cli, "--", ...cliArgs];
}

const GITHUB_ACTIONS_OUTPUT = "GITHUB_ACTIONS_OUTPUT" in process.env;

function log(...args) {
  const text = args.join(" ")
  if (GITHUB_ACTIONS_OUTPUT)
    core.info(styleText("yellow", text))
  else
    console.log(styleText("yellow", text))
}

function logError(...args) {
  const text = args.join(" ")
  if (GITHUB_ACTIONS_OUTPUT)
    core.error(styleText("red", text))
  else
    console.error(styleText("red", text))
}

function logGroup(name, body) {
  if (GITHUB_ACTIONS_OUTPUT) {
    core.startGroup(name);
  } else {
    log("=".repeat(80))
    log(name);
    log(".".repeat(80))
  }
  try {
    return body();
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup();
  } 
}

const SPAWN_OPTIONS =  { 
  stdio: ["inherit", "inherit", "inherit"]
};

function sh(binary, args) {
  const cmd = `${binary} ${args.join(" ")}`;
  if (GITHUB_ACTIONS_OUTPUT) {
    core.startGroup(binary);
    core.notice(styleText("blue", cmd));
  } else {
    console.log(styleText("blue", cmd));
  }
  try {
    const result = spawnSync(binary, args, SPAWN_OPTIONS);
    if (result.status || result.error) {
      logError(result.error);
      throw new Error(`Shell CMD failed: ${binary} ${args.join(" ")}`);
    }
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup()
  }
}

async function runTests() {
    const shellBinary = logGroup(`Installing JavaScript Shell: ${SHELL_NAME}`, testSetup);
    let success = true;
    success &&= runTest("Run UnitTests", () => sh(shellBinary, [UNIT_TEST_PATH]));
    success &&= runTest("Run Complete Suite", () => sh(shellBinary, convertCliArgs(CLI_PATH)));
    success &&= runTest("Run Single Suite", () => {
      sh(shellBinary, convertCliArgs(CLI_PATH, "proxy-mobx"));
    });
    if (!success) {
      process.exit(1)
    }
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
  return `${osName()}${osArch()}`
}

const DEFAULT_JSC_LOCATION = "/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc"

function testSetup() {
    sh("jsvu", [`--engines=${SHELL_NAME}`, `--os=${jsvuOSName()}`]);
    let shellBinary = path.join(os.homedir(), ".jsvu/bin", SHELL_NAME);
    if (!fs.existsSync(shellBinary) && SHELL_NAME == "javascriptcore")
      shellBinary = DEFAULT_JSC_LOCATION
    if (!fs.existsSync(shellBinary))
      throw new Error(`Could not find shell binary: ${shellBinary}`);
    log(`Installed JavaScript Shell: ${shellBinary}`);
    return shellBinary
}

function runTest(testName, test) {
    try {
      logGroup(testName, test)
    } catch(e) {
      logError("TEST FAILED")
      return false
    }
    return true
}

setImmediate(runTests);
