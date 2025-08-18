const EXPECTED_ASSERTION_COUNT = 1213680;



function quickHash(str) {
  let hash = 5381;
  let i = str.length;
  while (i > 0) {
    hash = (hash * 33) ^ (str.charCodeAt(i) | 0);
    i-= 919;
  }
  return hash | 0;
}

class Benchmark {
  lastResult;
  samples = [];

  async init() {
    await Promise.all([
      this.loadData("cpp", JetStream.preload.SAMPLE_CPP, -1086372285),
      this.loadData("css", JetStream.preload.SAMPLE_CSS, 1173668337),
      this.loadData("markup", JetStream.preload.SAMPLE_HTML, -270772291),
      this.loadData("js", JetStream.preload.SAMPLE_JS, -838545229),
      this.loadData("markdown", JetStream.preload.SAMPLE_MD, 5859883),
      this.loadData("sql", JetStream.preload.SAMPLE_SQL, 5859941),
      this.loadData("json", JetStream.preload.SAMPLE_JSON, 5859883),
      this.loadData("typescript", JetStream.preload.SAMPLE_TS, 133251625),
    ]);
  }

  async loadData(lang, file, hash) {
    const sample = { lang, hash  };
    // Push eagerly to have deterministic order.
    this.samples.push(sample);
    sample.content = await JetStream.getString(file);
    // Warm up quickHash and force good string representation.
    quickHash(sample.content);
    console.assert(sample.content.length > 0);
  }

  runIteration() {
    this.lastResult = PrismJSBenchmark.runTest(this.samples);
    for (const result of this.lastResult) {
      result.hash = quickHash(result.html);
    }
  }

  validate() {
    console.assert(this.lastResult.length == this.samples.length);
    for (let i = 0; i < this.samples.length; i++) {
      const sample = this.samples[i];
      const result = this.lastResult[i];
      console.assert(result.html.length > 0);
      console.assert(result.hash == sample.hash, `Invalid result.hash = ${result.hash}, expected ${sample.hash}`);
    }
  }
}
