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

(function testTagsAreStrings() {
  for (const benchmark of BENCHMARKS) {
    benchmark.tags.forEach(tag => assertTrue(typeof(tag) == "string"))
  }
})();



(function testTagsAll() {
  for (const benchmark of BENCHMARKS) {
    assertTrue(benchmark.tags instanceof Set);
    assertTrue(benchmark.tags.size > 0);
    assertTrue(benchmark.tags.has("all"));
    assertFalse(benchmark.tags.has("All"));
  }
})();


(function testDriverBenchmarksOrder() {
  const driver = new Driver();
  driver.enableBenchmarksByTag("all");
  assertEquals(driver.benchmarks.size, BENCHMARKS.length);
  driver.initializeBenchmarks();
  assertEquals(driver.benchmarks.length, BENCHMARKS.length);
  const names = driver.benchmarks.map(b => b.name.toLowerCase()).sort().reverse();
  for (let i = 0; i < names.length; i++) {
    assertEquals(driver.benchmarks[i].name.toLowerCase(), names[i]);
  }
})();


(function testEnableByTag() {
  const driverA = new Driver();
  const driverB = new Driver();
  driverA.enableBenchmarksByTag("Default");
  driverB.enableBenchmarksByTag("default");
  assertTrue(driverA.benchmarks.size > 0);
  assertEquals(driverA.benchmarks.size, driverB.benchmarks.size);
  const enabledBenchmarkNames = new Set(
      Array.from(driverA.benchmarks).map(b => b.name));
  for (const benchmark of BENCHMARKS) {
    if (benchmark.tags.has("default"))
      assertTrue(enabledBenchmarkNames.has(benchmark.name));
  }
})();
