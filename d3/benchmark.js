// Load D3 and data loading utilities for d8

function quickHash(str) {
    let hash = 5381;
    let i = str.length;
    while (i > 0) {
        hash = (hash * 33) ^ (str.charCodeAt(i) | 0);
        i -= 919;
    }
    return hash | 0;
}

const CACHE_BUST_COMMENT = "/*ThouShaltNotCache*/";
const CACHE_BUST_COMMENT_RE = new RegExp(`\n${RegExp.escape(CACHE_BUST_COMMENT)}\n`, "g");
const EXPECTED_LAST_RESULT_LENGTH = 691366;

globalThis.clearTimeout = () => { };

class Benchmark {
    measureStartup = true;
    sourceCode = "";
    sourceHash = 0;
    iterationSourceCodes = [];
    lastResult = "";
    currentIteration = 0;

    constructor(iterations) {
        this.iterations = iterations;
    }

    assert(test, message) {
        if (!test) {
            throw new Error(message);
        }
    }

    async init(verbose = 0) {
        this.sourceCode = await getString(sourceCodeBlob);
        this.sourceHash = quickHash(this.sourceCode);
        for (let i = 0; i < this.iterations; i++)
            this.iterationSourceCodes[i] = this.prepareCode(i);

        this.airportsCsvString = (await getString(airportsBlob));
        this.assert(this.airportsCsvString.length == 145493, `Expected this.airportsCsvString.length to be 141490 but got ${this.airportsCsvString.length}`);
        this.usDataJsonString = await getString(usDataBlob);
        this.assert(this.usDataJsonString.length == 2880996, `Expected this.usData.length to be 2880996 but got ${this.usDataJsonString.length}`);
        this.usData = JSON.parse(this.usDataJsonString);
    }

    prepareCode(iteration) {
        if (!this.measureStartup)
            return this.originalSource;
        // Alter the code per iteration to prevent caching.
        const iterationSourceCode = this.sourceCode.replaceAll(CACHE_BUST_COMMENT_RE, `/*${iteration}*/`);
        return iterationSourceCode;
    }

    runIteration() {
        let iterationSourceCode = this.iterationSourceCodes[this.currentIteration];
        if (!iterationSourceCode)
            throw new Error(`Could not find source for iteration ${this.currentIteration}`);
        // Module in sourceCode it assigned to the ReactRenderTest variable.
        let D3Test;
        eval(iterationSourceCode);
        this.lastResult = D3Test.runTest(this.airportsCsvString, this.usData);
        this.currentIteration++;
    }

    validate() {
        if (this.lastResult.length != EXPECTED_LAST_RESULT_LENGTH)
            throw new Error(`Expected this.lastResult.length to be ${EXPECTED_LAST_RESULT_LENGTH} but got ${this.lastResult.length}`);
    }
}