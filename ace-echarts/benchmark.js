class Benchmark {
    runIteration() {
        var result = EChartsBenchmark.runTest();
        console.assert(result.options.length > 0);
    }
}
