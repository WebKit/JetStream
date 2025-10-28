globalThis.console = {
  log() { },
  warn() { },
  assert(condition) {
    if (!condition) throw new Error("Invalid assertion");
  }
};

globalThis.clearTimeout = function () { };


// JetStream benchmark.
class Benchmark extends StartupBenchmark {
  // How many times (separate iterations) should we reuse the source code.
  // Use 0 to skip.
  lastResult = {};
  sourceHash = 0

  constructor({iterationCount}) {
    super({
      iterationCount,
      expectedCacheCommentCount: 597,
      sourceCodeReuseCount: 1,
    });
  }

  runIteration(iteration) {
    let sourceCode = this.iterationSourceCodes[iteration];
    if (!sourceCode)
      throw new Error(`Could not find source for iteration ${iteration}`);
    // Module in sourceCode it assigned to the ReactRenderTest variable.
    let ReactRenderTest;

    let initStart = performance.now();
    const res = eval(sourceCode);
    const runStart = performance.now();

    this.lastResult = ReactRenderTest.renderTest();
    this.lastResult.htmlHash = this.quickHash(this.lastResult.html);
    const end = performance.now();

    const loadTime = runStart - initStart;
    const runTime = end - runStart;
    // For local debugging: 
    // print(`Iteration ${iteration}:`);
    // print(`  Load time: ${loadTime.toFixed(2)}ms`);
    // print(`  Render time: ${runTime.toFixed(2)}ms`);
  }

  validate() {
    this.expect("HTML length", this.lastResult.html.length, 183778);
    this.expect("HTML hash", this.lastResult.htmlHash, 1177839858);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
