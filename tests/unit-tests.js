load("shell-config.js")
load("startup-helper/StartupBenchmark.js");
load("JetStreamDriver.js");

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message || "Assertion failed");
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

(function testTagsAreLowerCaseStrings() {
  for (const benchmark of BENCHMARKS) {
    benchmark.tags.forEach(tag => {
        assertTrue(typeof(tag) == "string");
        assertTrue(tag == tag.toLowerCase());
    })
  }
})();



(function testTagsAll() {
  for (const benchmark of BENCHMARKS) {
    const tags = benchmark.tags;
    assertTrue(tags instanceof Set);
    assertTrue(tags.size > 0);
    assertTrue(tags.has("all"));
    assertFalse(tags.has("All"));
    assertTrue(tags.has("default") ^ tags.has("disabled"));
  }
})();


(function testDriverBenchmarksOrder() {
  const benchmarks = findBenchmarksByTag("all");
  const driver = new Driver(benchmarks);
  assertEquals(driver.benchmarks.length, BENCHMARKS.length);
  const names = driver.benchmarks.map(b => b.name.toLowerCase()).sort().reverse();
  for (let i = 0; i < names.length; i++) {
    assertEquals(driver.benchmarks[i].name.toLowerCase(), names[i]);
  }
})();


(function testEnableByTag() {
  const driverA = new Driver(findBenchmarksByTag("Default"));
  const driverB = new Driver(findBenchmarksByTag("default"));
  assertTrue(driverA.benchmarks.length > 0);
  assertEquals(driverA.benchmarks.length, driverB.benchmarks.length);
  const enabledBenchmarkNames = new Set(
      Array.from(driverA.benchmarks).map(b => b.name));
  for (const benchmark of BENCHMARKS) {
    if (benchmark.tags.has("default"))
      assertTrue(enabledBenchmarkNames.has(benchmark.name));
  }
})();


(function testDriverEnableDuplicateAndSort() {
    const benchmarks = [...findBenchmarksByTag("wasm"), ...findBenchmarksByTag("wasm")];
    assertTrue(benchmarks.length > 0);
    const uniqueBenchmarks = new Set(benchmarks);
    assertFalse(uniqueBenchmarks.size == benchmarks.length);
    const driver = new Driver(benchmarks);
    assertEquals(driver.benchmarks.length, uniqueBenchmarks.size);
})();


(function testBenchmarkSubScores() {
  for (const benchmark of BENCHMARKS) {
    const subScores = benchmark.subScores();
    assertTrue(subScores instanceof Object);
    assertTrue(Object.keys(subScores).length > 0);
    for (const [name, value] of Object.entries(subScores)) {
      assertTrue(typeof(name) == "string");
      // "Score" can only be part of allScores().
      assertFalse(name == "Score");
      // Without running values should be either null (or 0 for GroupedBenchmark)
      assertFalse(value)
    }
  }
})();

(function testBenchmarkAllScores() {
  for (const benchmark of BENCHMARKS) {
    const subScores = benchmark.subScores();
    const allScores = benchmark.allScores();
    assertTrue("Score" in allScores);
    // All subScore items are part of allScores.
    for (const name of Object.keys(subScores))
      assertTrue(name in allScores);
  }
})();

function validateIterationSources(sources) {
  for (const source of sources) {
    assertTrue(typeof(source) == "string");
    assertFalse(source.includes(CACHE_BUST_COMMENT));
  }
}

(async function testStartupBenchmark() {
  const benchmark = new StartupBenchmark(12, 1);
  assertEquals(benchmark.iterationCount, 12);
  assertEquals(benchmark.expectedCacheCommentCount, 1);

  try {
    JetStream.preload = { BUNDLE: "test-bundle.js" };
    JetStream.getString = (file) => {
      assertEquals(file, "test-bundle.js");
      return `function test() { 
${CACHE_BUST_COMMENT}
        return 1;
        }`;
    }
    assertEquals(benchmark.iterationSourceCodes.length, 0);
    await benchmark.init();
    assertEquals(benchmark.iterationSourceCodes.length, 12);
    assertEquals(new Set(benchmark.iterationSourceCodes).size, 12);
    validateIterationSources(benchmark.iterationSourceCodes);

    const noReuseBenchmark = new StartupBenchmark(12, 1);
    noReuseBenchmark.codeReuseCount = 0;
    assertEquals(noReuseBenchmark.iterationSourceCodes.length, 0);
    await noReuseBenchmark.init();
    assertEquals(noReuseBenchmark.iterationSourceCodes.length, 12);
    assertEquals(new Set(noReuseBenchmark.iterationSourceCodes).size, 1);
    validateIterationSources(noReuseBenchmark.iterationSourceCodes);

    const reuseBenchmark = new StartupBenchmark(12, 1);
    reuseBenchmark.codeReuseCount = 3;
    assertEquals(reuseBenchmark.iterationSourceCodes.length, 0);
    await reuseBenchmark.init();
    assertEquals(reuseBenchmark.iterationSourceCodes.length, 12);
    assertEquals(new Set(reuseBenchmark.iterationSourceCodes).size, 4);
    validateIterationSources(reuseBenchmark.iterationSourceCodes);

    const reuseBenchmark2 = new StartupBenchmark(12, 1);
    reuseBenchmark2.codeReuseCount = 5;
    assertEquals(reuseBenchmark2.iterationSourceCodes.length, 0);
    await reuseBenchmark2.init();
    assertEquals(reuseBenchmark2.iterationSourceCodes.length, 12);
    assertEquals(new Set(reuseBenchmark2.iterationSourceCodes).size, 3);
    validateIterationSources(reuseBenchmark2.iterationSourceCodes);
  } finally {
    JetStream.preload = undefined;
    JetStream.getString = undefined;
  }
})();