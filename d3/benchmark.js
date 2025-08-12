// Load D3 and data loading utilities for d8


const EXPECTED_LAST_RESULT_LENGTH = 1771422;

class Benchmark {
    lastResult = "";

    runIteration() {

    }

    validate() {
        if (this.lastResult.length != EXPECTED_LAST_RESULT_LENGTH)
            throw new Error(`Expected this.lastResult.length to be ${EXPECTED_LAST_RESULT_LENGTH} but got ${this.lastResult.length}`)
    }
}