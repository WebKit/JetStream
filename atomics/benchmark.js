/*
 * Copyright (C) 2026 Sergey Rubanov. All rights reserved.
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
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

"use strict";

// Shared-memory ring buffer, the producer/consumer queue behind audio graphs
// and worker-backed UI state. The producer claims a slot, writes a fixed-size
// record, and publishes a sequence number the consumer observes. Both sides
// run on this agent, so worker scheduling stays out of the score.
// https://issues.chromium.org/issues/497018236

const CAPACITY = 1024;
const MASK = CAPACITY - 1;
const SLOT_WORDS = 4;
const HEADER_WORDS = 2;
const MESSAGES = 32768;
const BATCH = 64;

const WRITE_CURSOR = 0;
const READ_CURSOR = 1;

function slotBase(seq) {
    return HEADER_WORDS + (seq & MASK) * SLOT_WORDS;
}

function payloadA(seq) {
    return (Math.imul(seq, 3) + 1) >>> 0;
}

function payloadB(seq) {
    return (Math.imul(seq, 7) + 2) >>> 0;
}

function payloadSum(seq, a, b) {
    return (a + b + seq) >>> 0;
}

function expectedChecksum(count) {
    let checksum = 0;
    for (let seq = 0; seq < count; seq++) {
        const sum = payloadSum(seq, payloadA(seq), payloadB(seq));
        checksum = (checksum + sum) >>> 0;
    }
    return checksum;
}

class RingBuffer {
    constructor() {
        const words = HEADER_WORDS + CAPACITY * SLOT_WORDS;
        this.view = new Uint32Array(new SharedArrayBuffer(words * 4));
        this.expected = expectedChecksum(MESSAGES);
        this.checksum = 0;
        this.reset();
    }

    // Called from prepareForNextIteration, outside the timed region.
    reset() {
        this.view[WRITE_CURSOR] = 0;
        this.view[READ_CURSOR] = 0;
        for (let slot = 0; slot < CAPACITY; slot++)
            this.view[HEADER_WORDS + slot * SLOT_WORDS] = slot;
        this.checksum = 0;
    }

    publish(seq) {
        const base = slotBase(seq);
        const sequence = Atomics.load(this.view, base);
        if (sequence !== seq) throw new Error(`sequence ${sequence} != ${seq}`);
        const a = payloadA(seq);
        const b = payloadB(seq);
        Atomics.store(this.view, base + 1, a);
        Atomics.store(this.view, base + 2, b);
        Atomics.store(this.view, base + 3, payloadSum(seq, a, b));
        const previous = Atomics.compareExchange(this.view, base, seq, (seq + 1) >>> 0);
        if (previous !== seq) throw new Error(`publish lost sequence ${seq}`);
    }

    consume(seq) {
        const base = slotBase(seq);
        const readCursor = Atomics.load(this.view, READ_CURSOR);
        if (readCursor !== seq) throw new Error(`read cursor ${readCursor} != ${seq}`);
        const sequence = Atomics.load(this.view, base);
        if (sequence !== (seq + 1) >>> 0) throw new Error(`sequence ${sequence} != ${seq + 1}`);
        const a = Atomics.load(this.view, base + 1);
        const b = Atomics.load(this.view, base + 2);
        const sum = Atomics.load(this.view, base + 3);
        if (a !== payloadA(seq) || b !== payloadB(seq) || sum !== payloadSum(seq, a, b))
            throw new Error(`corrupt slot ${seq}`);
        Atomics.store(this.view, base, (seq + CAPACITY) >>> 0);
        Atomics.store(this.view, READ_CURSOR, (seq + 1) >>> 0);
        this.checksum = (this.checksum + sum) >>> 0;
    }

    run() {
        for (let start = 0; start < MESSAGES; start += BATCH) {
            for (let i = 0; i < BATCH; i++) {
                const seq = Atomics.add(this.view, WRITE_CURSOR, 1);
                this.publish(seq);
            }
            for (let i = 0; i < BATCH; i++) this.consume(start + i);
        }
        if (this.checksum !== this.expected)
            throw new Error(`checksum ${this.checksum} != ${this.expected}`);
        const writeCursor = Atomics.load(this.view, WRITE_CURSOR);
        if (writeCursor !== MESSAGES) throw new Error(`write cursor ${writeCursor} != ${MESSAGES}`);
    }
}

class Benchmark {
    constructor() {
        if (typeof SharedArrayBuffer !== "function" || typeof Atomics !== "object")
            throw new Error("atomics-ring-buffer requires SharedArrayBuffer and Atomics");
        this.ring = new RingBuffer();
    }

    prepareForNextIteration() {
        this.ring.reset();
    }

    runIteration() {
        this.ring.run();
    }
}
