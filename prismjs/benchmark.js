const EXPECTED_ASSERTION_COUNT = 1213680;

class Benchmark {
  lastResult;
  samples = [];

  async init() {
    this.samples.push({
      lang: "cpp",
      data: await JetStream.readString(JetStream.preload.SAMPLE_CPP),
    });
    this.samples.push({
      lang: "css",
      data: await JetStream.readString(JetStream.preload.SAMPLE_CSS),
    });
    this.samples.push({
      lang: "markup",
      data: await JetStream.readString(JetStream.preload.SAMPLE_HTML),
    });
    this.samples.push({
      lang: "js",
      data: await JetStream.readString(JetStream.preload.SAMPLE_JS),
    });
  }

  runIteration() {
    this.lastResult = PrismJSBenchmark.runTest(this.samples);
  }

  validate() {}
}
