#!/bin/bash
J2CL_REV=6a6e6d7d5d1278f0bcca60794882e0f0211e44d1
set -eo pipefail

# Cleanup old files.
rm -rf build/
rm -rf j2cl/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee "$BUILD_LOG"

# Build the benchmark from source.
git clone -q https://github.com/google/j2cl.git 2>&1 | tee -a "$BUILD_LOG"
pushd j2cl/
git checkout -q $J2CL_REV
git log -1 --oneline | tee -a "$BUILD_LOG"
BUILD_SRC_DIR="benchmarking/java/com/google/j2cl/benchmarks/octane/"
pushd "$BUILD_SRC_DIR"
bazel build //benchmarking/java/com/google/j2cl/benchmarks/octane:Box2dBenchmark_local-j2wasm-v8
popd
popd

echo "Copying generated files into build/" | tee -a "$BUILD_LOG"
mkdir -p build/ | tee -a "$BUILD_LOG"
BUILD_OUT_DIR="j2cl/bazel-bin/$BUILD_SRC_DIR"
cp $BUILD_OUT_DIR/Box2dBenchmark_j2wasm_entry.js build/ | tee -a "$BUILD_LOG"
cp $BUILD_OUT_DIR/Box2dBenchmark_j2wasm_binary.wasm build/ | tee -a "$BUILD_LOG"
cp $BUILD_OUT_DIR/Box2dBenchmark_j2wasm_binary.binaryen.symbolmap build/ | tee -a "$BUILD_LOG"
echo "Build success" | tee -a "$BUILD_LOG"
