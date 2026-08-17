/*!
 * Copyright (c) 2026 Jesse Delia
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
if (!globalThis.Blob) {
  globalThis.Blob = class Blob {
    constructor(parts) {
      this._buffer = parts[0].buffer || parts[0];
      this.size = this._buffer.byteLength;
    }
    async arrayBuffer() {
      // Create a new ArrayBuffer in the *current* Realm so `instanceof ArrayBuffer` checks
      // inside PDF-lib pass successfully (passing the raw outer-realm ArrayBuffer fails!).
      const dst = new Uint8Array(this.size);
      dst.set(new Uint8Array(this._buffer));
      return dst.buffer;
    }
  };
}
if (!globalThis.File) {
  globalThis.File = class File extends globalThis.Blob {
    constructor(parts, name) {
      super(parts);
      this.name = name;
    }
  };
}

class Benchmark {
  constructor(iterationCount) {
    this.iterationCount = iterationCount;
    this.specsToRun = [];
    this.corpusMap = new Map();
    this.lastResults = [];
  }

  async init() {
    this.specsToRun = [
      FilemorfPdfCore.SPECS["merge-2"],
      FilemorfPdfCore.SPECS["split-20"]
    ];

    let requiredFilesArr = [];
    for (const spec of this.specsToRun) {
      requiredFilesArr.push(...spec.inputs);
    }
    let requiredFiles = new Set(requiredFilesArr);

    for (const filename of requiredFiles) {
      const cachePath = JetStream.preload[filename];
      const arrayBuf = await JetStream.getBinary(cachePath);
      this.corpusMap.set(filename, new File([arrayBuf], filename));
    }
  }

  async runIteration() {
    const results = [];
    for (const spec of this.specsToRun) {
      const files = spec.inputs.map(name => this.corpusMap.get(name));
      const result = await spec.run(files);
      results.push({
        id: spec.id,
        outputFiles: result.outputFiles,
        outputBytes: result.outputBytes,
        blobs: result.blobs
      });
    }
    this.lastResults = results;
  }

  validate() {
    for (const res of this.lastResults) {
       if (res.id === "merge-2") {
          this.expect("merge-2 files", res.outputFiles, 1);
          if (res.outputBytes <= 0) throw new Error("Merge failed: zero bytes");
       } else if (res.id === "split-20") {
          this.expect("split-20 files", res.outputFiles, 20);
       }
    }
  }

  expect(name, value, expected) {
    if (value !== expected) {
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
    }
  }
}
