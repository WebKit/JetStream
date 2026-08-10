// Polyfill Blob and File for JS Shells (v8, jsc, spidermonkey)
if (typeof globalThis.Blob === "undefined") {
  globalThis.Blob = class Blob {
    constructor(parts = [], options = {}) {
      this.parts = parts;
      this.type = options.type || "";
      let size = 0;
      for (const part of parts) {
        if (part instanceof ArrayBuffer) size += part.byteLength;
        else if (part.buffer) size += part.byteLength;
        else size += part.length || 0;
      }
      this.size = size;
    }
    async arrayBuffer() {
      const result = new Uint8Array(this.size);
      let offset = 0;
      for (const part of this.parts) {
        if (part instanceof ArrayBuffer) {
          result.set(new Uint8Array(part), offset);
          offset += part.byteLength;
        } else if (part.buffer) {
          result.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), offset);
          offset += part.byteLength;
        }
      }
      return result.buffer;
    }
  };
}

if (typeof globalThis.File === "undefined") {
  globalThis.File = class File extends globalThis.Blob {
    constructor(parts, name, options = {}) {
      super(parts, options);
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

    let requiredFiles = new Set();
    for (const spec of this.specsToRun) {
      for (const input of spec.inputs) {
        requiredFiles.add(input);
      }
    }

    for (const filename of requiredFiles) {
      const arrayBuf = await JetStream.getBinary('./filemorf-pdf/corpus/files/' + filename);
      this.corpusMap.set(filename, new File([arrayBuf], filename, { type: "application/pdf" }));
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
