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
    if (iterations > 25)
      throw new Error("Too many iterations");
    for (let i = 0; i < iterations; i++)
      this.sources[i] = this.prepareCode(i)
  }

  prepareCode(iteration) {
    // Alter the code per iteration to prevent caching.
    const comment = `// Iteration: ${iteration}`;
    const reactName = `React${String.fromCharCode(97+iteration)}`
    const sourceCOde = `${comment}\n${this.originalSource}\n${comment}`;
    sourceCOde.replaceAll("React", reactName);
    return sourceCOde;
  }

  runIteration() {
    const sourceCode = this.sources[this.iteration];
    let ReactRenderTest = {};
    let initStart = performance.now(); 
    const res = eval(sourceCode);
    const runStart = performance.now();
    this.lastResult = ReactRenderTest.renderTest();
    const end = performance.now();
    const loadTime = runStart - initStart;
    const runTime = end - runStart;
    // print(`Iteration ${this.iteration}:`);
    // print(`  Load time: ${loadTime.toFixed(2)}ms`);
    // print(`  Render time: ${runTime.toFixed(2)}ms`);
    this.iteration++;
  }

  validate() {
    this.expect("HTML length", this.lastResult.html.length, 188947);
    this.expect("HTML hash", hash(this.lastResult.html), 197561020);
    this.expect("Wine cards", this.lastResult.wineCardCount, 100);
    this.expect("Solid tags", this.lastResult.solidTagCount, 95);
  }

  expect(name, value, expected) {
    if (value !=expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
