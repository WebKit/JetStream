/*
 * Copyright (C) 2023 Apple Inc. All rights reserved.
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

"use strict";

function computeIsLittleEndian() {
    let buf = new ArrayBuffer(4);
    let dv = new DataView(buf);
    dv.setUint32(0, 0x11223344, true);
    let view = new Uint8Array(buf);
    return view[0] === 0x44;
}

const isLittleEndian = computeIsLittleEndian();
let globalCounter = 0;

function randomFileContents() {
    const numBytes = (globalCounter % 128)  + 2056;
    globalCounter++;
    let result = new ArrayBuffer(numBytes);
    let view = new Uint8Array(result);
    for (let i = 0; i < numBytes; ++i)
        view[i] = (i + globalCounter) % 255;
    return new DataView(result);
}


class File {
    constructor(dataView, permissions) {
        this._data = dataView;
    }

    get data() { return this._data; }

    set data(dataView) { this._data = dataView; }

    swapByteOrder() {
        let hash = 0x1a2b3c4d;
        for (let i = 0; i < Math.floor(this.data.byteLength / 8) * 8; i += 8) {
            const data = this.data.getFloat64(i, isLittleEndian);
            this.data.setFloat64(i, data, !isLittleEndian);
            hash ^= data | 0;
        }
        return hash;
    }
}

class Directory {
    constructor() {
        this.structure = new Map;
    }

    addFile(name, file) {
        let entry = this.structure.get(name);
        if (entry !== undefined) {
            if (entry instanceof File)
                throw new Error("Can't replace file with file.");
            if (entry instanceof Directory)
                throw new Error("Can't replace a file with a new directory.");
            throw new Error("Should not reach this code");
        }

        this.structure.set(name, file);
        return file;
    }

    addDirectory(name, directory = new Directory) {
        let entry = this.structure.get(name);
        if (entry !== undefined) {
            if (entry instanceof File)
                throw new Error("Can't replace file with directory.");
            if (entry instanceof Directory)
                throw new Error("Can't replace directory with new directory.");
            throw new Error("Should not reach this code");
        }

        this.structure.set(name, directory);
        return directory;
    }

    * ls() {
        for (let [name, entry] of this.structure)
            yield { name, entry, isDirectory: entry instanceof Directory };
    }

    * forEachFile() {
        for (let item of this.ls()) {
            if (!item.isDirectory)
                yield item;
        }
    }

    * forEachFileRecursively() {
        for (let item of this.ls()) {
            if (item.isDirectory)
                yield* item.entry.forEachFileRecursively();
            else
                yield item;
        } 
    }

    * forEachDirectoryRecursively() {
        for (let item of this.ls()) {
            if (!item.isDirectory)
                continue;

            yield* item.entry.forEachDirectoryRecursively();
            yield item;
        } 
    }

    fileCount() {
        let count = 0;
        for (let item of this.ls()) {
            if (!item.isDirectory)
                ++count;
        }

        return count;
    }

    rm(name) {
        return this.structure.delete(name);
    }
}

function setupDirectory() {
    const fs = new Directory;
    let dirs = [fs];
    let counter = 0;
    for (let dir of dirs) {
        for (let i = 0; i < 10; ++i) {
            if (dirs.length < 400 && (counter % 3) <= 1) {
                dirs.push(dir.addDirectory(`dir-${i}`));
            }
            counter++;
        }
    }

    for (let dir of dirs) {
        for (let i = 0; i < 5; ++i) {
            if ((counter % 3) === 0) {
                dir.addFile(`file-${i}`, new File(randomFileContents()));
            }
            counter++;
        }
    }

    return fs;
}

class Benchmark {
    EXPECTED_FILE_COUNT = 666;

    totalFileCount = 0;
    lastFileHash = undefined;

    runIteration() {
        const fs = setupDirectory();

        for (let { entry: file } of fs.forEachFileRecursively()) {
            this.lastFileHash = file.swapByteOrder();
        }

        for (let { name, entry: dir } of fs.forEachDirectoryRecursively()) {
            if (dir.fileCount() > 3) {
                for (let { name } of dir.forEachFile()) {
                    let result = dir.rm(name);
                    if (!result)
                        throw new Error("rm should have returned true");
                    
                }
            }
        }

        for (let _ of fs.forEachFileRecursively()) {
            this.totalFileCount++;
        }
    }

    validate(iterations) {
        const expectedFileCount = this.EXPECTED_FILE_COUNT * iterations;
        if (this.totalFileCount != expectedFileCount)
            throw new Error(`Invalid total file count ${this.totalFileCount}, expected ${expectedFileCount}.`);
        if (this.lastFileHash === undefined)
            throw new Error(`Invalid file hash: ${this.lastFileHash}`);
    }
}
