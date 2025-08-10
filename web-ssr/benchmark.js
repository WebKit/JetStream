globalThis.console = {
  log() { },
  warn() { },
  assert(condition) {
    if (!condition) throw new Error("Invalid assertion")
  }
};

globalThis.clearTimeout = function() {};


function hash(str) {
  let hash = 5381; // Start with a prime number
  let i = str.length;
  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  return hash | 0;
}


class Benchmark {
  iteration = 0
  lastResult = {};
  sources = []

  constructor(iterations) {
    this.originalSource = REACT_RENDER_TEST_SRC;
    for (let i = 0; i < iterations; i++)
      this.sources[i] = this.prepareCode(i)
  }

  prepareCode(iteration) {
    // Alter the code per iteration to prevent caching.
    const iterationId = `${String.fromCharCode(97+(iteration % 25))}${iteration}`
    const sourceCode = this.originalSource.replaceAll("/*ThouShaltNotCache*/", `/*${iterationId}*/`);
    return sourceCode;
  }

  runIteration() {
    let sourceCode = this.sources[this.iteration];
    let ReactRenderTest = {};
    let initStart = performance.now(); 
    const res = eval(sourceCode);
    const runStart = performance.now();
    this.lastResult = ReactRenderTest.renderTest();
    this.lastResult.htmlHash = hash(this.lastResult.html)
    const end = performance.now();
    const loadTime = runStart - initStart;
    const runTime = end - runStart;
    // Debug information
    // print(`Iteration ${this.iteration}:`);
    // print(`  Load time: ${loadTime.toFixed(2)}ms`);
    // print(`  Render time: ${runTime.toFixed(2)}ms`);
    this.iteration++;
  }

  validate() {
    this.expect("HTML length", this.lastResult.html.length, 183778);
    this.expect("HTML hash", this.lastResult.htmlHash, -1001898509);
  }

  expect(name, value, expected) {
    if (value !=expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
