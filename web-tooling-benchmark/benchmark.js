



class Benchmark {
  files = Object.create(null);

  constructor(iterations) {
    this.iterations = iterations;
  }

  async init() {
    let WTBenchmark;
    await this.loadAllFiles(JetStream.preload);
    this.sourceCode = this.files.SCRIPT_BUNDLE;
    this.WTBenchmark = self.WTBenchmark;
  }

  async loadAllFiles(preload) {
    const loadPromises = Object.entries(preload).map(
      async ([name, url]) => {
        if (name.endsWith(".wasm")) {
          this.files[name] = (await JetStream.getBinary(url)).buffer;
        } else {
          this.files[name] = await JetStream.getString(url);
        }
      })
    await Promise.all(loadPromises);
  }

  async runIteration() {
    await this.WTBenchmark.runTest(this.files);
  }
}