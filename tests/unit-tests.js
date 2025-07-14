load("shell-config.js")
load("JetStreamDriver.js");

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

(function testTagsAreStrings() {
  for (const benchmark of BENCHMARKS) {
    benchmark.tags.forEach(tag => assertTrue(typeof(tag) == "string"))
  }
})();