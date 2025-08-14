

function quickHash(str) {
  let hash = 5381;
  let i = str.length;
  while (i > 0) {
    hash = (hash * 33) ^ (str.charCodeAt(i) | 0);
    i-= 919;
  }
  return hash | 0;
}

// console.log = () => {};

const CACHE_BUST_COMMENT = "/*ThouShaltNotCache*/";
const CACHE_BUST_COMMENT_RE = new RegExp(`\n${RegExp.escape(CACHE_BUST_COMMENT)}\n`, "g");

// JetStream benchmark.
class Benchmark {
  measureStartup = true;
  iterationCount = 0;
  iteration = 0;
  lastResult = {};
  sourceCode;
  sourceHash = 0
  iterationSourceCodes = [];

  constructor(iterationCount) {
    this.iterationCount = iterationCount
  }

  async init() {
    this.sourceCode = await getString(CLASS_STARTUP_BLOB);
    this.expect("Cache Comment Count", this.sourceCode.match(CACHE_BUST_COMMENT_RE).length, 20301);
    for (let i = 0; i < this.iterationCount; i++)
      this.iterationSourceCodes[i] = this.prepareCode(i);
  }


  prepareCode(iteration) {
    if (!this.measureStartup)
      return this.sourceCode;
    // Alter the code per iteration to prevent caching.
    const iterationId = `${String.fromCharCode(97 + (iteration % 25))}${iteration}`;
    const sourceCode = this.sourceCode.replaceAll(CACHE_BUST_COMMENT_RE, `/*${iterationId}*/`);
    // Warm up the hash function.
    this.sourceHash = quickHash(sourceCode);
    return sourceCode;
  }

  runIteration() {
    let sourceCode = this.iterationSourceCodes[this.iteration];
    if (!sourceCode)
      throw new Error(`Could not find source for iteration ${this.iteration}`);
    // Module in sourceCode it assigned to the ReactRenderTest variable.
    for (let i = 0; i < 3; i++) {
      let ClassStartupTest;

      let initStart = performance.now();
      const res = eval(sourceCode);
      const runStart = performance.now();

      const classNames = ClassStartupTest.runTest();
      this.lastResult = {
        classNames,
      };
      const end = performance.now();
      const loadTime = runStart - initStart;
      const runTime = end - runStart;
      // For local debugging: 
      // print(`Iteration ${this.iteration}:`);
      // print(`  Load time: ${loadTime.toFixed(2)}ms`);
      // print(`  Render time: ${runTime.toFixed(2)}ms`);
    }

    this.iteration++;
  }

  validate() {
    this.expect("Exported Classes", this.lastResult.classNames.length, 2135);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}