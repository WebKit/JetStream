globalThis.console = {
  log() { },
  warn() { },
  assert(condition) {
    if (!condition) throw new Error("Invalid assertion");
  }
};

globalThis.clearTimeout = function () { };


function quickHash(str) {
  let hash = 5381;
  let i = str.length;
  while (i > 0) {
    hash = (hash * 33) ^ (str.charCodeAt(i) | 0);
    i-= 919;
  }
  return hash | 0;
}

// Warm up the hash function.
const REACT_RENDER_TEST_SRC_HASH = quickHash(REACT_RENDER_TEST_SRC);

// JetStream benchmark.
class Benchmark {
  measureStartup = true;
  iteration = 0;
  lastResult = {};
  sources = [];

  constructor(iterations) {
    this.originalSource = REACT_RENDER_TEST_SRC;
    for (let i = 0; i < iterations; i++)
      this.sources[i] = this.prepareCode(i);
  }

  prepareCode(iteration) {
    if (!this.measureStartup)
      return this.originalSource;
    // Alter the code per iteration to prevent caching.
    const iterationId = `${String.fromCharCode(97 + (iteration % 25))}${iteration}`;
    const sourceCode = this.originalSource.replaceAll("/*ThouShaltNotCache*/", `/*${iterationId}*/`);
    return sourceCode;
  }

  runIteration() {
    let sourceCode = this.sources[this.iteration];
    if (!sourceCode)
      throw new Error(`Could not find source for iteration ${this.iteration}`);
    // Module in sourceCode it assigned to the ReactRenderTest variable.
    let ReactRenderTest;

    let initStart = performance.now();
    const res = eval(sourceCode);
    const runStart = performance.now();

    this.lastResult = ReactRenderTest.renderTest();
    this.lastResult.htmlHash = quickHash(this.lastResult.html);
    const end = performance.now();

    const loadTime = runStart - initStart;
    const runTime = end - runStart;
    // For local debugging: 
    // print(`Iteration ${this.iteration}:`);
    // print(`  Load time: ${loadTime.toFixed(2)}ms`);
    // print(`  Render time: ${runTime.toFixed(2)}ms`);
    this.iteration++;
  }

  validate() {
    this.expect("Source HTML hash", REACT_RENDER_TEST_SRC_HASH, -1771319017);
    this.expect("HTML length", this.lastResult.html.length, 183778);
    this.expect("HTML hash", this.lastResult.htmlHash, 1177839858);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
