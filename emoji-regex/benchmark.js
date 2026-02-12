/*
 * Copyright (C) 2026 Apple Inc. All rights reserved.
 * Copyright 2026 Google LLC
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

class Benchmark extends StartupBenchmark {
    results = [];
    totalHash = 0xdeadbeef;
    samples = [];

    constructor({iterationCount}) {
        super({
            iterationCount,
            expectedCacheCommentCount: 1,
            sourceCodeReuseCount: 1,
        });
    }

    async init() {
        const fileNames = ["small.txt", "medium.txt", "large.txt"];
        await Promise.all([
            super.init(),
            ...fileNames.map(file => this.loadData(file)),
        ]);
    }

    async loadData(fileName) {
        const content = await JetStream.getString(JetStream.preload[fileName]);
        this.samples.push(content);
        console.assert(content.length > 0);
    }

    runIteration(iteration) {
        let EmojiRegexBenchmark;
        eval(this.iterationSourceCodes[iteration]);

        for (const sample of this.samples) {
            const result = EmojiRegexBenchmark.renderEmojis(sample);
            if (result.length <= 100) {
                throw new Error(`Invalid result length: ${result.length}`);
            }
            this.totalHash ^= this.quickHash(result);
        }
    }
}
