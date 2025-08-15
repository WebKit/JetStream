

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
  // How many times (separate iterations) should we reuse the source code.
  // Use 0 to skip.
  CODE_REUSE_COUNT = 2
  iterationCount = 0;
  iteration = 0;
  sourceCode;
  sourceHash = 0
  iterationSourceCodes = [];
  lastResult = {};

  constructor(iterationCount) {
    this.iterationCount = iterationCount
  }

  async init() {
    this.sourceCode = await JetStream.getString(JetStream.preload.BUNDLE_BLOB);
    console.assert("Cache Comment Count", [21230, 21238].includes(this.sourceCode.match(CACHE_BUST_COMMENT_RE).length));
    for (let i = 0; i < this.iterationCount; i++)
      this.iterationSourceCodes[i] = this.prepareCode(i);
  }


  prepareCode(iteration) {
    if (!this.CODE_REUSE_COUNT)
      return this.sourceCode;
    // Alter the code per iteration to prevent caching.
    const cacheId = Math.floor(iteration / this.CODE_REUSE_COUNT);
    const previousSourceCode = this.iterationSourceCodes[cacheId];
    if (previousSourceCode)
      return previousSourceCode
    const sourceCode = this.sourceCode.replaceAll(CACHE_BUST_COMMENT_RE, `/*${cacheId}*/`);
    // Ensure efficient string representation.
    this.sourceHash = quickHash(sourceCode);
    return sourceCode;
  }

  runIteration() {
    let sourceCode = this.iterationSourceCodes[this.iteration];
    if (!sourceCode)
      throw new Error(`Could not find source for iteration ${this.iteration}`);
    // Module in sourceCode it assigned to the ClassStartupTest variable.
    let BabylonJSBenchmark;

    let initStart = performance.now();
    const res = eval(sourceCode);
    const runStart = performance.now();

    const {classNames, cameraRotationLength} = BabylonJSBenchmark.runTest(30);
    this.lastResult = {
      classNames,
      cameraRotationLength,
    };
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
    this.expect("this.lastResult.classNames.length", this.lastResult.classNames.length, 2135);
    this.expect("this.lastResult.cameraRotationLength", Math.round(this.lastResult.cameraRotationLength * 1000), 464);
  }

  expect(name, value, expected) {
    if (value != expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}