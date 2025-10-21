// Copyright (C) 2007-2025 Apple Inc. All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions
// are met:
// 1. Redistributions of source code must retain the above copyright
//  notice, this list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright
//  notice, this list of conditions and the following disclaimer in the
//  documentation and/or other materials provided with the distribution.

// THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
// THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
// PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
// BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
// THE POSSIBILITY OF SUCH DAMAGE.

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
