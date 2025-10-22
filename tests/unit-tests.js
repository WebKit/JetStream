load("shell-config.js");
load("params.js");
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

function assertThrows(message, func) {
  let didThrow = false;
  try {
    func();
  } catch (e) {
    didThrow = true;
  }
  assertTrue(didThrow, message);
}

(function testTagsAreLowerCaseStrings() {
  for (const benchmark of BENCHMARKS) {
    benchmark.tags.forEach((tag) => {
      assertTrue(typeof tag == "string");
      assertTrue(tag == tag.toLowerCase());
    });
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


(function tagsAreNotBenchmarkNames() {
  const benchmarkNames = new Set(BENCHMARKS.map(e => e.name));
  for (const benchmark of benchmarks) {
    for (const tag of benchmark.tags) {
      assertFalse(benchmarkNames.has(tag), `'${tag}' is also a benchmark name`);
    }
  }
})();

(function tagsHasWasmOrJS() {
  for (const benchmark of benchmarks) {
    const tags = benchmark.tags;
    assertTrue(tags.has("wasm") || tags.has("js"), `'${benchmark.name}' has no 'js' or 'wasm' tag`);
  }
})();

(function testDriverBenchmarksOrder() {
  const benchmarks = findBenchmarksByTag("all");
  const driver = new Driver(benchmarks);
  assertEquals(driver.benchmarks.length, BENCHMARKS.length);
  const names = driver.benchmarks
    .map((b) => b.name.toLowerCase())
    .sort()
    .reverse();
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
    Array.from(driverA.benchmarks).map((b) => b.name)
  );
  for (const benchmark of BENCHMARKS) {
    if (benchmark.tags.has("default"))
      assertTrue(enabledBenchmarkNames.has(benchmark.name));
  }
})();

(function testDriverEnableDuplicateAndSort() {
  const benchmarks = [
    ...findBenchmarksByTag("wasm"),
    ...findBenchmarksByTag("wasm"),
  ];
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
      assertTrue(typeof name == "string");
      // "Score" can only be part of allScores().
      assertFalse(name == "Score");
      // Without running values should be either null (or 0 for GroupedBenchmark)
      assertFalse(value);
    }
  }
})();

(function testBenchmarkAllScores() {
  for (const benchmark of BENCHMARKS) {
    const subScores = benchmark.subScores();
    const allScores = benchmark.allScores();
    assertTrue("Score" in allScores);
    // All subScore items are part of allScores.
    for (const name of Object.keys(subScores)) assertTrue(name in allScores);
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

function validateIterationSources(sources) {
  for (const source of sources) {
    assertTrue(typeof source == "string");
    assertFalse(source.includes(CACHE_BUST_COMMENT));
  }
}

(async function testStartupBenchmark() {
  try {
    JetStream.preload = { BUNDLE: "test-bundle.js" };
    JetStream.getString = (file) => {
      assertEquals(file, "test-bundle.js");
      return `function test() { 
${CACHE_BUST_COMMENT}
        return 1;
        }`;
    };
    await testStartupBenchmarkInnerTests();
  } finally {
    JetStream.preload = undefined;
    JetStream.getString = undefined;
  }
})();

async function testStartupBenchmarkInnerTests() {
  const benchmark = new StartupBenchmark({
    iterationCount: 12,
    expectedCacheCommentCount: 1,
  });
  assertEquals(benchmark.iterationCount, 12);
  assertEquals(benchmark.expectedCacheCommentCount, 1);
  assertEquals(benchmark.iterationSourceCodes.length, 0);
  assertEquals(benchmark.sourceCode, undefined);
  assertEquals(benchmark.sourceHash, 0);
  await benchmark.init();
  assertEquals(benchmark.sourceHash, 177573);
  assertEquals(benchmark.sourceCode.length, 68);
  assertEquals(benchmark.iterationSourceCodes.length, 12);
  assertEquals(new Set(benchmark.iterationSourceCodes).size, 12);
  validateIterationSources(benchmark.iterationSourceCodes);

  const noReuseBenchmark = new StartupBenchmark({
    iterationCount: 12,
    expectedCacheCommentCount: 1,
    sourceCodeReuseCount: 0,
  });
  assertEquals(noReuseBenchmark.iterationSourceCodes.length, 0);
  await noReuseBenchmark.init();
  assertEquals(noReuseBenchmark.iterationSourceCodes.length, 12);
  assertEquals(new Set(noReuseBenchmark.iterationSourceCodes).size, 1);
  validateIterationSources(noReuseBenchmark.iterationSourceCodes);

  const reuseBenchmark = new StartupBenchmark({
    iterationCount: 12,
    expectedCacheCommentCount: 1,
    sourceCodeReuseCount: 3,
  });
  assertEquals(reuseBenchmark.iterationSourceCodes.length, 0);
  await reuseBenchmark.init();
  assertEquals(reuseBenchmark.iterationSourceCodes.length, 12);
  assertEquals(new Set(reuseBenchmark.iterationSourceCodes).size, 4);
  validateIterationSources(reuseBenchmark.iterationSourceCodes);

  const reuseBenchmark2 = new StartupBenchmark({
    iterationCount: 12,
    expectedCacheCommentCount: 1,
    sourceCodeReuseCount: 5,
  });
  assertEquals(reuseBenchmark2.iterationSourceCodes.length, 0);
  await reuseBenchmark2.init();
  assertEquals(reuseBenchmark2.iterationSourceCodes.length, 12);
  assertEquals(new Set(reuseBenchmark2.iterationSourceCodes).size, 3);
  validateIterationSources(reuseBenchmark2.iterationSourceCodes);
}

(function testStartupBenchmarkThrow() {
  assertThrows(
    "StartupBenchmark constructor should throw with no arguments.",
    () => new StartupBenchmark()
  );

  assertThrows(
    "StartupBenchmark constructor should throw with missing expectedCacheCommentCount.",
    () => new StartupBenchmark({ iterationCount: 1 })
  );

  assertThrows(
    "StartupBenchmark constructor should throw with missing iterationCount.",
    () => new StartupBenchmark({ expectedCacheCommentCount: 1 })
  );

  assertThrows(
    "StartupBenchmark constructor should throw with iterationCount=0.",
    () => {
      new StartupBenchmark({ iterationCount: 0, expectedCacheCommentCount: 1 });
    }
  );

  assertThrows(
    "StartupBenchmark constructor should throw with expectedCacheCommentCount=0.",
    () => {
      new StartupBenchmark({ iterationCount: 1, expectedCacheCommentCount: 0 });
    }
  );
})();
