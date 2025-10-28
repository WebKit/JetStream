/*
 * Copyright (C) 2018 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE INC. AND ITS CONTRIBUTORS ``AS IS''
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO,
 * THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
 * PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL APPLE INC. OR ITS CONTRIBUTORS
 * BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF
 * THE POSSIBILITY OF SUCH DAMAGE.
*/

const NUM_WORKERS = 25;

const MAX_CONCURRENCY_STARTUP = 8;
const MAX_CONCURRENT_RUNNING = 16;
let resolve = null;

let numWorkers = 0;
function startWorker(file) {
    numWorkers++;
    let worker = new Worker(file);
    worker.onmessage = function(event) {
        if (event.data === "done") {
            --numWorkers;
            if (!numWorkers)
                resolve();
        }
    };
}

const WORKER_SUB_TESTS = [
    JetStream.preload.rayTrace3D,
    JetStream.preload.accessNbody,
    JetStream.preload.morph3D,
    JetStream.preload.cube3D,
    JetStream.preload.accessFunnkuch,
    JetStream.preload.accessBinaryTrees,
    JetStream.preload.accessNsieve,
    JetStream.preload.bitopsBitwiseAnd,
    JetStream.preload.bitopsNsieveBits,
    JetStream.preload.controlflowRecursive,
    JetStream.preload.bitops3BitBitsInByte,
    JetStream.preload.botopsBitsInByte,
    JetStream.preload.cryptoAES,
    JetStream.preload.cryptoMD5,
    JetStream.preload.cryptoSHA1,
    JetStream.preload.dateFormatTofte,
    JetStream.preload.dateFormatXparb,
    JetStream.preload.mathCordic,
    JetStream.preload.mathPartialSums,
    JetStream.preload.mathSpectralNorm,
    JetStream.preload.stringBase64,
    JetStream.preload.stringFasta,
    JetStream.preload.stringValidateInput,
    JetStream.preload.stringTagcloud,
    JetStream.preload.stringUnpackCode,
    JetStream.preload.regexpDNA,
];


class Benchmark {
    workers = [];

    async runIteration() {
        if (this.workers.length != 0) {
            throw new Error("Something bad happened.");
        }
        await this.startWorkers();
        if (this.workers.length != NUM_WORKERS)
            throw new Error(`Invalid total worker count, got ${this.workers.length} expected ${NUM_WORKERS}`);
        await this.runSubTests();
        this.workers = [];
    }

    async startWorkers() {
        if (!JetStream.isInBrowser)
            throw new Error("Only works in browser");
        let testIndex = 0;
        while (this.workers.length < NUM_WORKERS) {
            const workerGroup = [];
            for (let i = 0; i < MAX_CONCURRENCY_STARTUP; i++) {
                const subtest = WORKER_SUB_TESTS[testIndex % WORKER_SUB_TESTS.length];
                const worker = new BenchmarkWorker(subtest);
                workerGroup.push(worker);
                this.workers.push(worker);
                testIndex++;
                if (this.workers.length == NUM_WORKERS)
                    break;
            }
            await Promise.all(workerGroup.map(worker => worker.readyPromise));
        }
    }

    async runSubTests() {
        const workerGroups = this.splitWorkerRunGroups();
        if (workerGroups.length != MAX_CONCURRENT_RUNNING)
            throw new Error(`Invalid workerGroups.length, got ${workerGroups.length} expected ${MAX_CONCURRENT_RUNNING}`);
        // Run each worker group in parallel.
        await Promise.all(workerGroups.map(group => this.runGroupWorkloads(group)));
    }
    
    splitWorkerRunGroups() {
        const workers = this.workers.slice();
        const groups = new Array(MAX_CONCURRENT_RUNNING).fill(null).map(_ => []);
        let groupIndex = 0;
        while (workers.length > 0) {
            groups[groupIndex % groups.length].push(workers.pop());
            groupIndex++;
        }
        return groups;
    }

    async runGroupWorkloads(workers) {
        for (const worker of workers) 
            await worker.runWorkload();
    }
}


class BenchmarkWorker {
    _worker;
    constructor(file) {
        this._worker = new Worker(file);
        this.readyPromise = new Promise((resolve, reject) => {
            this._worker.onmessage = (event) => {
                switch (event.data) {
                    case "ready": {
                        resolve();
                        break;
                    }
                    default:
                        reject(new Error(`Unknown worker message: ${event.data}`));
                }
            };
        });
    }

    async runWorkload() {
        await new Promise((resolve, reject) => {
            this._worker.onmessage = (event) => {
                switch (event.data) {
                    case "done": {
                        resolve();
                        break;
                    }
                    default:
                        reject(new Error(`Unknown worker message: ${event.data}`));
                }
            };
            this._worker.postMessage("start");
        });
    }
}
