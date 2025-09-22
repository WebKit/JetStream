#! /usr/bin/env node

import commandLineArgs from "command-line-args";
import fs from "fs";
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { logError, printHelp, runTest, sh } from "./helper.mjs";

const optionDefinitions = [
  { name: "help", alias: "h", description: "Print this help text." },
];

const options = commandLineArgs(optionDefinitions);

if ("help" in options)
  printHelp(optionDefinitions);

const FILE_PATH = fileURLToPath(import.meta.url);
const SRC_DIR = path.dirname(path.dirname(FILE_PATH));

async function findPackageJsonFiles(dir, accumulator=[]) {
    const dirEntries = await fs.readdir(dir, { withFileTypes: true });
    for (const dirent of dirEntries) {
        if (dirent.name === 'node_modules' || dirent.name === '.git')
            continue;
        const res = join(dir, dirent.name);
        if (dirent.isDirectory()) {
            findPackageJsonFiles(res, accumulator);
        }
        if (dirent.name === 'package.json') {
            accumulator.push(res)
        }
    }
    return accumulator;
}

async function runBuilds() {
    const packageJsonFiles = await findPackageJsonFiles(SRC_DIR);
    let success = true;

    for (const file of packageJsonFiles) {
        const content = await fs.readFile(file, 'utf-8');
        const packageJson = JSON.parse(content);
        if (!packageJson.scripts?.build) {
            continue;
        }

        const dir = dirname(file);
        const testName = `Building ${packageJson.name || dir}`;
        
        const buildTask = async () => {
            await sh('npm', 'install', '--prefix', dir);
            await sh('npm', 'run', 'build', '--prefix', dir);
            await sh('git', 'reset', '--hard');
        };
        
        success &&= await runTest(testName, buildTask);
    }

    if (!success) {
        logError("One or more builds failed.");
        process.exit(1);
    }
}

setImmediate(runBuilds);