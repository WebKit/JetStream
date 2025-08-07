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
    // this.originalSource = readFile("./web-ssr/dist/react-render-test.js")
    if (iterations > 25)
      throw new Error("Too many iterations");
    for (let i = 0; i < iterations; i++)
      this.sources[i] = this.prepareCode(i)
  }

  prepareCode(iteration) {
    const comment = `// Iteration: ${iteration}`;
    const reactName = `React${String.fromCharCode(97+iteration)}`
    const sourceCOde = `${comment}\n${this.originalSource}\n${comment}`;
    sourceCOde.replaceAll("React", reactName);
    return sourceCOde;
  }

  runIteration() {
    const sourceCode = this.sources[this.iteration];
    const res = eval(sourceCode);
    print(res)
    this.lastResult = globalThis.ReactRenderTest.renderTest();
    // 4. Print results
    print(`Iteration ${iteration}:`);
    print(`  Load time: ${loadTime.toFixed(2)}ms`);
    print(`  Render time: ${result.duration.toFixed(2)}ms`);
    this.iteration++;
  }

  validate() {
    this.expect("HTML length", result.html.length, 5000);
    this.expect("HTML hash", hash(result.html), 123);
    this.expect("Wine cards", result.wineCardCount, 100);
    this.expect("Solid tags", result.solidTagCount, 95);
  }

  expect(name, value, expected) {
    if (value !=expected)
      throw new Error(`Expected ${name} to be ${expected}, but got ${value}`);
  }
}
