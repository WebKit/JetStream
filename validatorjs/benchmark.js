
const EXPECTED_ASSERTION_COUNT = 1156560;
class Benchmark {
  assertionCount = 0;
  runIteration() {
    this.assertionCount = ValidatorJSBenchmark.runTest();
  }

  validate() {
    if (this.assertionCount != EXPECTED_ASSERTION_COUNT)
      throw new Error(`Expected ${EXPECTED_ASSERTION_COUNT} assertions, but got ${this.assertionCount}`);

  }
}