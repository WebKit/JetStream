class Benchmark {
    runIteration() {
        const result = EChartsBenchmark.runTest();
        console.assert(result.options.length > 0);
    }
}
