#!/bin/bash

set -eo pipefail

# Cleanup old files.
rm -rf build/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date --rfc-3339=seconds)" | tee "$BUILD_LOG"

# Build the benchmark from source.
git clone https://github.com/JetBrains/compose-multiplatform.git |& tee -a "$BUILD_LOG"
pushd compose-multiplatform/
git log -1 --oneline | tee -a "$BUILD_LOG"
pushd benchmarks/multiplatform
./gradlew :benchmarks:wasmJsProductionExecutableCompileSync
# For building polyfills and JavaScript launcher to run in d8 (which inspires the benchmark.js launcher here):
# ./gradlew :benchmarks:buildD8Distribution
BUILD_SRC_DIR="compose-multiplatform/benchmarks/multiplatform/build/wasm/packages/compose-benchmarks-benchmarks/kotlin"
popd
popd

echo "Copying generated files into build/" | tee -a "$BUILD_LOG"
mkdir -p build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/compose-benchmarks-benchmarks.{wasm,uninstantiated.mjs} build/ | tee -a "$BUILD_LOG"
git apply hook-print.patch | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/skiko.{wasm,mjs} build/ | tee -a "$BUILD_LOG"
git apply skiko-disable-instantiate.patch | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/example1_cat.jpg build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/compose-multiplatform.png build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/files/example1_compose-community-primary.png build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/font/jetbrainsmono_*.ttf build/ | tee -a "$BUILD_LOG"
echo "Build success" | tee -a "$BUILD_LOG"
