import { styleText } from "node:util";
import core from "@actions/core";
import commandLineUsage from "command-line-usage";

export const GITHUB_ACTIONS_OUTPUT = "GITHUB_ACTIONS_OUTPUT" in process.env;

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
