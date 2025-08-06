#!/bin/bash

set -eo pipefail

# Cleanup old files.
rm -rf wasm_gc_benchmarks/
rm -rf build/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date)" | tee "$BUILD_LOG"

git clone https://github.com/mkustermann/wasm_gc_benchmarks 2>&1 | tee -a "$BUILD_LOG"
pushd wasm_gc_benchmarks/
git log -1 --oneline | tee -a "$BUILD_LOG"
popd

echo "Copying files from wasm_gc_benchmarks/ into build/" | tee -a "$BUILD_LOG"
mkdir -p build/ | tee -a "$BUILD_LOG"
# Generic Dart2wasm runner.
cp wasm_gc_benchmarks/tools/run_wasm.js build/ | tee -a "$BUILD_LOG"
# "Flute Complex" benchmark application.
# cp wasm_gc_benchmarks/benchmarks-out/flute.complex.dart2wasm.mjs build/flute.dart2wasm.mjs | tee -a "$BUILD_LOG"
# cp wasm_gc_benchmarks/benchmarks-out/flute.complex.dart2wasm.wasm build/flute.dart2wasm.wasm | tee -a "$BUILD_LOG"
cp wasm_gc_benchmarks/benchmarks-out/flute.complex.dart2wasm.{mjs,wasm} build/ | tee -a "$BUILD_LOG"
cp wasm_gc_benchmarks/benchmarks-out/flute.todomvc.dart2wasm.{mjs,wasm} build/ | tee -a "$BUILD_LOG"

echo "Build success" | tee -a "$BUILD_LOG"

# TODO: We could actually build the application/benchmark from Dart sources with
# the dart2wasm compiler / Dart SDK. See `wasm_gc_benchmarks/compile.sh`
