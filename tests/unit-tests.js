load("shell-config.js")
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


(function checkUtf16Sources() {
  // Test that only explicitly UTF16-enabled benchmarks can have sources
  // with non-8-byte characters.
  const twoByteCharsRegex = /[^\x00-\xFF]/g;
  const jsFileRegex = /\.(js|mjs)$/;

  function checkFile(benchmarkName, file, type) {
      if (!jsFileRegex.test(file))
          return;
      const content = read(file);
      const match = content.match(twoByteCharsRegex);
      if (!match)
          return;
      const uniqueMatches = Array.from(new Set(match));
      const offendingChars = uniqueMatches.map(char => {
          const hex = char.charCodeAt(0).toString(16).padStart(4, "0");
          return `\n        - \\u${hex}: '${char}'`;
      }).join("");
      throw new Error(
        `Benchmark '${benchmarkName}' has two-byte characters in ${type} '${file}':\n` +
        `    Offending characters: ${offendingChars}`);
  }

  for (const benchmark of BENCHMARKS) {
    if (benchmark.allowUtf16)
        continue;

    for (const file of benchmark.files) {
        checkFile(benchmark.name, file, "file");
    }

    if (benchmark.plan.preload) {
        for (const [name, file] of Object.entries(benchmark.plan.preload)) {
            checkFile(benchmark.name, file, `preload.${name}`);
        }
    }
  }
})();
