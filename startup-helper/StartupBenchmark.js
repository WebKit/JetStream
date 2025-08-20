const CACHE_BUST_COMMENT = "/*ThouShaltNotCache*/";
const CACHE_BUST_COMMENT_RE = new RegExp(
  `\n${RegExp.escape(CACHE_BUST_COMMENT)}\n`,
  "g"
);

class StartupBenchmark {
  // How many times (separate iterations) should we reuse the source code.
  // Use 0 to skip.
  codeReuseCount = 1;
  iterationCount = 0;
  sourceCode;
  sourceHash = 0;
  expectedCacheCommentCount = 0;

  iterationSourceCodes = [];

  constructor(iterationCount, expectedCacheCommentCount) {
    this.iterationCount = iterationCount;
    this.expectedCacheCommentCount = expectedCacheCommentCount;
    console.assert(expectedCacheCommentCount > 0);
  }

  async init() {
    this.sourceCode = await JetStream.getString(JetStream.preload.BUNDLE);
    const cacheCommentCount = this.sourceCode.match(
      CACHE_BUST_COMMENT_RE
    ).length;
    this.sourceHash = this.quickHash(this.sourceCode);
    this.validateSourceCacheComments(cacheCommentCount);
    for (let i = 0; i < this.iterationCount; i++)
      this.iterationSourceCodes[i] = this.createIterationSourceCode(i);
    this.validateIterationSourceCodes();
  }

  validateSourceCacheComments(cacheCommentCount) {
    console.assert(
      cacheCommentCount === this.expectedCacheCommentCount,
      `Invalid cache comment count ${cacheCommentCount} expected ${this.expectedCacheCommentCount}.`
    );
  }

  validateIterationSourceCodes() {
    if (this.iterationSourceCodes.some((each) => !each?.length))
      throw new Error(`Got invalid iterationSourceCodes`);
    let expectedSize = 1;
    if (this.codeReuseCount !== 0)
      expectedSize = Math.ceil(this.iterationCount / this.codeReuseCount);
    const uniqueSources = new Set(this.iterationSourceCodes);
    if (uniqueSources.size != expectedSize)
      throw new Error(
        `Expected ${expectedSize} unique sources, but got ${uniqueSources.size}.`
      );
  }
  createIterationSourceCode(iteration) {
    // Alter the code per iteration to prevent caching.
    const cacheId =
      Math.floor(iteration / this.codeReuseCount) * this.codeReuseCount;
    // Reuse existing sources if this.codeReuseCount > 1:
    if (cacheId < this.iterationSourceCodes.length)
      return this.iterationSourceCodes[cacheId];

    const sourceCode = this.sourceCode.replaceAll(
      CACHE_BUST_COMMENT_RE,
      `/*${cacheId}*/`
    );
    // Warm up quickHash.
    this.quickHash(sourceCode);
    return sourceCode;
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
