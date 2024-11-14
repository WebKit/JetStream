#!/bin/bash

set -e
set -o pipefail

# Cleanup old files.
# rm -rf src/
rm -rf build/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date --rfc-3339=seconds)\n" | tee "$BUILD_LOG"

echo "Toolchain versions" | tee -a "$BUILD_LOG"
emcc --version | head -n1 | tee -a "$BUILD_LOG"
echo -e "wasm-strip $(wasm-strip --version)\n" | tee -a "$BUILD_LOG"

SQLITE_SRC_URL="https://sqlite.org/2024/sqlite-src-3470000.zip"
echo -e "Getting sources from $SQLITE_SRC_URL\n" | tee -a "$BUILD_LOG"
SQLITE_SRC_FILE="$(basename $SQLITE_SRC_URL)"
# curl -o "$SQLITE_SRC_FILE" $SQLITE_SRC_URL
# unzip "$SQLITE_SRC_FILE"
# mv sqlite-src*/ src/

# Paths and information in make output could be sensitive, so don't save in log.
echo "Building..." | tee -a "$BUILD_LOG"
pushd src
./configure
cd ext/wasm
make dist
popd

echo "Copying files from src/ext/wasm/ into build/" | tee -a "$BUILD_LOG"
mkdir -p build/{common,jswasm} | tee -a "$BUILD_LOG"
cp src/ext/wasm/jswasm/speedtest1.{js,wasm} build/jswasm/ | tee -a "$BUILD_LOG"
# The next ones are just needed for the browser build.
# cp src/ext/wasm/speedtest1.html build/ | tee -a "$BUILD_LOG"
# cp src/ext/wasm/common/{emscripten.css,SqliteTestUtil.js,testing.css} build/common/ | tee -a "$BUILD_LOG"

echo "Build success" | tee -a "$BUILD_LOG"
