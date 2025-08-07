globalThis.console = {
  log() { },
  warn() { },
  assert(condition) {
    if (!condition) throw new Error("Invalid assertion")
  }
};

globalThis.clearTimeout = function() {};

if (typeof readFile == "undefined")
  readFile = read
const BUNDLE_PATH = "./dist/react-render-test.js";
const originalBundle = readFile(BUNDLE_PATH);

function runBenchmarkIteration(iteration) {
  // 1. Modify the bundle to prevent caching
  const comment = `// Iteration: ${iteration}`;
  if (iteration > 25)
    throw new Error("Too many iterations");
  const reactName = `React${String.fromCharCode(97+iteration)}`
  const modifiedBundle = `${comment}\n${originalBundle}\n${comment}`;
  modifiedBundle.replaceAll("React", reactName);

  // 2. Load and execute the modified bundle
  let loadTime;
  const then = performance.now();
  eval(modifiedBundle);
  loadTime = performance.now() - then;

  // 3. Run the render benchmark
  const result = reactRenderTest.renderTest();

  // 4. Print results
  print(`Iteration ${iteration}:`);
  print(`  Load time: ${loadTime.toFixed(2)}ms`);
  print(`  Render time: ${result.duration.toFixed(2)}ms`);
  print(`  HTML length: ${result.html.length}`);
  print(`  HTML hash: ${hash(result.html)}`);
  print(`  Wine cards: ${result.wineCardCount}`);
  print(`  Solid tags: ${result.solidTagCount}`);

  return {
    loadTime,
    renderTime: result.duration,
    htmlLength: result.html.length,
    htmlHash: hash(result.html),
    wineCardCount: result.wineCardCount,
    solidTagCount: result.solidTagCount
  };
}

function hash(str) {
  let hash = 5381; // Start with a prime number
  let i = str.length;
  while (i) {
    hash = (hash * 33) ^ str.charCodeAt(--i);
  }
  return hash | 0;
}

const NUM_ITERATIONS = 1;
const results = [];
for (let i = 0; i < NUM_ITERATIONS; i++) {
  results.push(runBenchmarkIteration(i));
}

const avgLoadTime = results.reduce((sum, r) => sum + r.loadTime, 0) / NUM_ITERATIONS;
const avgRenderTime = results.reduce((sum, r) => sum + r.renderTime, 0) / NUM_ITERATIONS;

print(`Average Load Time:   ${avgLoadTime.toFixed(2)}ms`);
print(`Average Render Time: ${avgRenderTime.toFixed(2)}ms`);
print(`Average Total Time:  ${(avgLoadTime + avgRenderTime).toFixed(2)}ms`);
print("")