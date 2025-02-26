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

const BASE_CLI_ARGS_WITH_OPTIONS = [CLI_PATH];
if (SHELL_NAME != "spidermonkey")
  BASE_CLI_ARGS_WITH_OPTIONS.push("--");
Object.freeze(BASE_CLI_ARGS_WITH_OPTIONS);

const GITHUB_ACTIONS_OUTPUT = "GITHUB_ACTIONS_OUTPUT" in process.env;

function log(...args) {
  const text = args.join(" ")
  if (GITHUB_ACTIONS_OUTPUT)
    core.info(styleText("yellow", text))
  else
    console.log(styleText("yellow", text))
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
      console.error(result.error);
      throw new Error(`Shell CMD failed: ${binary} ${args.join(" ")}`);
    }
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup()
  }
}

async function runTests() {
    const shellBinary = logGroup(`Installing JavaScript Shell: ${SHELL_NAME}`, testSetup);
    runTest("Run Complete Suite", () => sh(shellBinary, [CLI_PATH]));
    runTest("Run Single Suite", () => {
      const singleTestArgs = [...BASE_CLI_ARGS_WITH_OPTIONS, "proxy-mobx"];
      sh(shellBinary, singleTestArgs);
    });
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
          case "ia32": return "32";
          case "arm64": return "64arm";
          default: throw new Error("Unsupported architecture");
      }
  };
  return `${osName()}${osArch()}`
}

function testSetup() {
    const jsvuOS = "mac64arm";
    sh("jsvu", [`--engines=${SHELL_NAME}`, `--os=${jsvuOSName()}`]);
    const shellBinary = path.join(os.homedir(), ".jsvu/bin", SHELL_NAME);
    if (!fs.existsSync(shellBinary))
      throw new Error(`Could not find shell binary: ${shellBinary}`);
    log(`Installed JavaScript Shell: ${shellBinary}`);
    return shellBinary
}

function runTest(testName, test) {
    try {
      logGroup(testName, test)
    } catch(e) {
      console.error("TEST FAILED")
    }
}

setImmediate(runTests);