# JSDOM D3 Startup Benchmark

This workload benchmarks the time it takes to generate an SVG map of US airports using D3.js in a Node.js environment with `jsdom`.

The benchmark reads airport and US geography data, then uses D3 to create a Voronoi diagram of the airports overlaid on a map of the US.

## Setup
```bash
# Install node deps from package-lock.json
npm ci; 
# Bundle sources to dist/*.
npm run build
# Use build:dev for non-minified sources.
npm run build:dev
```

# Testing
```bash
# Run the basic node benchmark implementation for development. 
npm run test
```
