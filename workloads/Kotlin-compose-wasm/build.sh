#!/bin/bash

set -eo pipefail

# Cleanup old files.
rm -rf build/
rm -rf compose-multiplatform/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee "$BUILD_LOG"

# Build the benchmark from source.
# TODO: Update CMP_REV to a newer compose-multiplatform commit once Compose
# 1.13.0 is stable and drop the explicit -Pcompose.version=1.13.0-beta01
# override below.
CMP_REV="1574503571a25a3e71f71fef51962beefc494df6"
CMP_VERSION_OVERRIDE="1.13.0-beta01"
git clone -q https://github.com/JetBrains/compose-multiplatform.git 2>&1 | tee -a "$BUILD_LOG"
pushd compose-multiplatform/
git checkout -q "$CMP_REV" 2>&1 | tee -a "$BUILD_LOG"
git log -1 --oneline | tee -a "$BUILD_LOG"
echo "Toolchain versions (Skiko follows from Compose):" | tee -a "$BUILD_LOG"
grep -E '^(kotlin|compose-multiplatform) = ' benchmarks/multiplatform/gradle/libs.versions.toml | tee -a "$BUILD_LOG"
echo "compose.version override = \"$CMP_VERSION_OVERRIDE\" (Skiko 0.156.0)" | tee -a "$BUILD_LOG"
# Do not read `isD8` in the main function which decides whether to run eagerly.
# Instead, just patch that out statically.
# TODO: Upstream that fix to the compose-multiplatform repo.
git apply ../empty-main-function.patch | tee -a "$BUILD_LOG"
# Pass -Xwasm-kclass-fqn=false to the Kotlin/Wasm compile and link tasks.
# TODO(https://youtrack.jetbrains.com/issue/KT-91066): Remove
# compiler-options.patch once KT-91066 is fixed.
git apply ../compiler-options.patch | tee -a "$BUILD_LOG"
pushd benchmarks/multiplatform
./gradlew :benchmarks:wasmJsProductionExecutableCompileSync -Pcompose.version="$CMP_VERSION_OVERRIDE"
# For building polyfills and JavaScript launcher to run in d8 (which inspires the benchmark.js launcher here):
# ./gradlew :benchmarks:prepareWasmJsD8ProductionRuntime
BUILD_SRC_DIR="compose-multiplatform/benchmarks/multiplatform/build/wasm/packages/compose-benchmarks-benchmarks/kotlin"
popd
popd

echo "Copying generated files into build/" | tee -a "$BUILD_LOG"
mkdir -p build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/compose-benchmarks-benchmarks.wasm build/ | tee -a "$BUILD_LOG"
# Rewrite static ES module imports in the generated import-object module so it
# can be loaded from a Blob URL in browsers and without unused dependencies in
# JS shells (`@js-joda/core`, `.js-builtins.mjs`).
sed -E "s|^import \* as ([A-Za-z0-9_$]+) from ('[^']+');$|const \1 = globalThis.kotlinWasmImports?.[\2] ?? {};|" \
  "$BUILD_SRC_DIR/compose-benchmarks-benchmarks.import-object.mjs" \
  > build/compose-benchmarks-benchmarks.import-object.mjs
if grep -nE '^\s*import\s' build/compose-benchmarks-benchmarks.import-object.mjs; then
  echo "Error: unrewritten static import in compose-benchmarks-benchmarks.import-object.mjs" >&2
  exit 1
fi
cp $BUILD_SRC_DIR/skiko.{wasm,mjs} build/ | tee -a "$BUILD_LOG"
git apply skiko-disable-instantiate.patch | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/example1_cat.jpg build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/drawable/compose-multiplatform.png build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/files/example1_compose-community-primary.png build/ | tee -a "$BUILD_LOG"
cp $BUILD_SRC_DIR/composeResources/compose_benchmarks.benchmarks.generated.resources/font/jetbrainsmono_*.ttf build/ | tee -a "$BUILD_LOG"
echo "Build success" | tee -a "$BUILD_LOG"
