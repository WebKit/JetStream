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

    let requiredFiles = new Set();
    for (const spec of this.specsToRun) {
      for (const input of spec.inputs) requiredFiles.add(input);
    }

    for (const filename of requiredFiles) {
      let cachePath;
      if (filename === "merge-00.pdf") cachePath = JetStream.preload.F0;
      else if (filename === "merge-01.pdf") cachePath = JetStream.preload.F1;
      else if (filename === "text-020.pdf") cachePath = JetStream.preload.F2;
      
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
