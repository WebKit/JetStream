const CACHE_BUST_COMMENT = "/*ThouShaltNotCache*/";
const CACHE_BUST_COMMENT_RE = new RegExp(
  `\n${RegExp.escape(CACHE_BUST_COMMENT)}\n`,
  "g"
);

class StartupBenchmark {
  // Total iterations for this benchmark.
  #iterationCount = 0;
  // Original source code.
  #sourceCode;
  // quickHahs(this.#sourceCode) for use in custom validate() methods.
  #sourceHash = 0;
  // Number of no-cache comments in the original #sourceCode.
  #expectedCacheCommentCount = 0;
  // How many times (separate iterations) should we reuse the source code.
  #sourceCodeReuseCount = 1;
  // Current iteration being prepared
  #currentIteration = 0;
  // Source code for the current iteration
  #currentIterationSourceCode = null;

  constructor({
    iterationCount,
    expectedCacheCommentCount,
    sourceCodeReuseCount = 1,
  } = {}) {
    console.assert(
      iterationCount > 0,
      `Expected iterationCount to be positive, but got ${iterationCount}`
    );
    this.#iterationCount = iterationCount;
    console.assert(
      expectedCacheCommentCount > 0,
      `Expected expectedCacheCommentCount to be positive, but got ${expectedCacheCommentCount}`
    );
    this.#expectedCacheCommentCount = expectedCacheCommentCount;
    console.assert(
      sourceCodeReuseCount > 0,
      `Expected sourceCodeReuseCount to be positive, but got ${sourceCodeReuseCount}`
    );
    this.#sourceCodeReuseCount = sourceCodeReuseCount;
  }

  get iterationCount() {
    return this.#iterationCount;
  }

  get sourceCode() {
    return this.#sourceCode;
  }

  get sourceHash() {
    return this.#sourceHash;
  }

  get expectedCacheCommentCount() {
    return this.#expectedCacheCommentCount;
  }

  get sourceCodeReuseCount() {
    return this.#sourceCodeReuseCount;
  }

  get currentIterationSourceCode() {
    return this.#currentIterationSourceCode;
  }

  async init() {
    if (!JetStream.preload.BUNDLE) {
      throw new Error("Missing JetStream.preload.BUNDLE");
    }
    this.#sourceCode = await JetStream.getString(JetStream.preload.BUNDLE);
    if (!this.sourceCode || !this.sourceCode.length) {
      throw new Error("Couldn't load JetStream.preload.BUNDLE");
    }

    const cacheCommentCount = this.sourceCode.match(
      CACHE_BUST_COMMENT_RE
    ).length;
    this.#sourceHash = this.quickHash(this.sourceCode);
    this.validateSourceCacheComments(cacheCommentCount);
  }

  validateSourceCacheComments(cacheCommentCount) {
    console.assert(
      cacheCommentCount === this.expectedCacheCommentCount,
      `Invalid cache comment count ${cacheCommentCount} expected ${this.expectedCacheCommentCount}.`
    );
  }

  createIterationSourceCode(iteration) {
    if ((iteration % this.sourceCodeReuseCount) !== 0)
      return this.#currentIterationSourceCode;

    // Alter the code per iteration to prevent caching.
    const cacheId =
      Math.floor(iteration / this.sourceCodeReuseCount) *
      this.sourceCodeReuseCount;

    const sourceCode = this.sourceCode.replaceAll(
      CACHE_BUST_COMMENT_RE,
      `/*${cacheId}*/`
    );
    // Warm up quickHash.
    this.quickHash(sourceCode);
    return sourceCode;
  }

  prepareForNextIteration() {
    this.#currentIterationSourceCode = this.createIterationSourceCode(this.#currentIteration);
    this.#currentIteration++;
  }

  quickHash(str) {
    let hash = 5381;
    let i = str.length;
    while (i > 0) {
      hash = (hash * 33) ^ (str.charCodeAt(i) | 0);
      i -= 919;
    }
    return hash | 0;
  }
}
