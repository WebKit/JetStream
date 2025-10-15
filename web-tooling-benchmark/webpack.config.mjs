// Copyright 2017 the V8 project authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

import path from "path";
import webpack from "webpack";
import { fileURLToPath } from "url";
import { targetList } from "./src/cli/flags-helper.mjs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const srcDir = path.resolve(__dirname, "src");
const distDir = path.resolve(__dirname, "dist");

function getTargets(env) {
  const only = env && env.only;
  if (only && targetList.has(only)) {
    return [only];
  }
  return [...targetList];
}

export default async (env) => {
  const targets = getTargets(env);
  const entries = Object.create(null);
  for (const target of targets) {
    entries[target] = path.join(srcDir, `${target}.mjs`);
  }

  const baseConfig = {
    entry: entries,
    target: ["web", "es6"],
    resolve: {
      alias: {
        url: require.resolve("whatwg-url"),
      },
      fallback: {
        path: require.resolve("path-browserify"),
        assert: require.resolve("assert/"),
        os: require.resolve("os-browserify/browser"),
        crypto: require.resolve("crypto-browserify"),
        stream: require.resolve("stream-browserify"),
        url: require.resolve("url/"),
        util: require.resolve("util/"),
        vm: require.resolve("vm-browserify"),
        buffer: require.resolve("buffer/"),
        fs: false,
        "fs/promises": false,
        module: false,
        perf_hooks: false,
        process: false,
        v8: false,
        fsevents: false,
        process: require.resolve("process/browser.js"),
      },
    },
    plugins: [
      new webpack.ProvidePlugin({
        process: "process/browser.js",
        TextEncoder: ["text-encoder", "TextEncoder"],
        TextDecoder: ["text-encoder", "TextDecoder"],
      }),
    ],
  };

  const libraryConfig = {
    name: "WTBenchmark",
    type: "global",
  };

  const configs = [];
  if (env.production) {
    configs.push({
      ...baseConfig,
      devtool: "source-map",
      output: {
        path: distDir,
        filename: "[name].bundle.min.js",
        library: libraryConfig,
        chunkFormat: "commonjs",
      },
      optimization: {
        minimize: true,
      },
      mode: "production",
    });
  }

  if (env.development) {
    configs.push({
      ...baseConfig,
      output: {
        path: distDir,
        filename: "[name].bundle.js",
        library: libraryConfig,
      },
      optimization: {
        minimize: false,
      },
      mode: "none"
    });
  }

  return configs;
};
