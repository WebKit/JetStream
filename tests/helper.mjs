import core from "@actions/core";
import { spawn } from "child_process";
import commandLineUsage from "command-line-usage";
import { styleText } from "node:util";

export const GITHUB_ACTIONS_OUTPUT = ("GITHUB_ACTIONS_OUTPUT" in process.env) || ("GITHUB_EVENT_PATH "in process.env);

export function logInfo(...args) {
  const text = args.join(" ")
  if (GITHUB_ACTIONS_OUTPUT)
    core.info(styleText("yellow", text));
  else
    console.log(styleText("yellow", text));
}

export function logError(...args) {
  let error;
  if (args.length == 1 && args[0] instanceof Error)
    error = args[0];
  const text = args.join(" ");
  if (GITHUB_ACTIONS_OUTPUT) {
    if (error?.stack)
      core.error(error.stack);
    else
      core.error(styleText("red", text));
  } else {
    if (error?.stack)
      console.error(styleText("red", error.stack));
    else
      console.error(styleText("red", text));
  }
}

export function logCommand(...args) {
  const cmd = args.join(" ");
  if (GITHUB_ACTIONS_OUTPUT) {
    core.notice(styleText("blue", cmd));
  } else {
    console.log(styleText("blue", cmd));
  }
}


export async function logGroup(name, body) {
  if (GITHUB_ACTIONS_OUTPUT) {
    core.startGroup(name);
  } else {
    logInfo("=".repeat(80));
    logInfo(name);
    logInfo(".".repeat(80));
  }
  try {
    return await body();
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup();
  } 
}


export function printHelp(message = "", optionDefinitions) {
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


export async function runTest(label, testFunction) {
    try {
      await logGroup(label, testFunction);
      logInfo("✅ Test completed!");
    } catch(e) {
      logError("❌ Test failed!");
      logError(e);
      return false;
    }
    return true;
}


export async function sh(binary, ...args) {
  const cmd = `${binary} ${args.join(" ")}`;
  if (GITHUB_ACTIONS_OUTPUT)
    core.startGroup(binary);
  logCommand(cmd);
  try {
    return await spawnCaptureStdout(binary, args);
  } catch(e) {
    logError(e.stdoutString);
    throw e;
  } finally {
    if (GITHUB_ACTIONS_OUTPUT)
      core.endGroup();
  }
}

const SPAWN_OPTIONS =  Object.freeze({ 
  stdio: ["inherit", "pipe", "inherit"]
});

async function spawnCaptureStdout(binary, args, options={}) {
  options = Object.assign(options, SPAWN_OPTIONS);
  const childProcess = spawn(binary, args, options);
  childProcess.stdout.pipe(process.stdout);
  return new Promise((resolve, reject) => {
    childProcess.stdoutString = "";
    childProcess.stdio[1].on("data", (data) => {
      childProcess.stdoutString += data.toString();
    });
    childProcess.on("close", (code) => {
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
    childProcess.on("error", reject);
  })
}
