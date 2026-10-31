#!/bin/bash

set -eo pipefail

# Cleanup old files.
rm -f sqlite-src-*.zip
rm -rf sqlite-src-*/
rm -rf build/

touch build.log
BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')\n" | tee "$BUILD_LOG"

echo "Toolchain versions" | tee -a "$BUILD_LOG"
emcc --version | head -n1 | tee -a "$BUILD_LOG"
echo -e "wasm-strip $(wasm-strip --version)\n" | tee -a "$BUILD_LOG"

# Check https://sqlite.org/download.html and update the source link, if needed.
SQLITE_SRC_URL="https://sqlite.org/2026/sqlite-src-3540100.zip"
echo -e "Getting sources from $SQLITE_SRC_URL\n" | tee -a "$BUILD_LOG"
SQLITE_SRC_FILE="$(basename $SQLITE_SRC_URL)"
curl -o "$SQLITE_SRC_FILE" $SQLITE_SRC_URL
unzip "$SQLITE_SRC_FILE"

# Paths and information in make output could be sensitive, so don't save in log.
echo "Building..." | tee -a "$BUILD_LOG"
pushd sqlite-src-*/
./configure
# ext/wasm/GNUmakefile expects the amalgamation to exist already.
make sqlite3.c
cd ext/wasm
# Emscripten 6.0.2 removed `wasmBinary` from the default INCOMING_MODULE_JS_API
# list, and setting the list replaces the default, so name every Module property
# that benchmark.js and the speedtest1 glue code pass in.
# `make dist` no longer builds speedtest1, so build that target directly:
# - CC="cc -DSQLITE_DISABLE_INTRINSIC" builds the host c-pp preprocessor
#   without GCC's __builtin_ceil/__builtin_floor, which at -O0 emit calls to
#   libm's ceil()/floor() whereas GNUmakefile links c-pp without -lm.
#   (speedtest1.wasm itself is compiled by emcc, not $(CC).)
# - WASM_CUSTOM_INSTANTIATE=0 uses Emscripten's loader instead of SQLite's
#   fetch()-based one, which JS shells don't have.
# - emcc_opt=-Oz matches the optimization level that `make dist` used.
# - bin.wasm-opt= skips SQLite's extra `wasm-opt --all-features` pass, which
#   makes current Binaryen emit compact imports (0x7f) that engines reject.
EMCC_CFLAGS="-sINCOMING_MODULE_JS_API=wasmBinary,print,printErr,preRun,postRun,noInitialRun" \
    make speedtest1 CC="cc -DSQLITE_DISABLE_INTRINSIC" WASM_CUSTOM_INSTANTIATE=0 emcc_opt=-Oz bin.wasm-opt=
popd

echo "Copying files from sqlite-src-*/ext/wasm/ into build/" | tee -a "$BUILD_LOG"
mkdir -p build/{common,jswasm} | tee -a "$BUILD_LOG"
cp sqlite-src-*/ext/wasm/jswasm/speedtest1.{js,wasm} build/jswasm/ | tee -a "$BUILD_LOG"
# The next files are only needed for the upstream browser build, not the
# JetStream version, hence don't copy them by default.
# cp sqlite-src-*/ext/wasm/speedtest1.html build/ | tee -a "$BUILD_LOG"
# cp sqlite-src-*/ext/wasm/common/{emscripten.css,SqliteTestUtil.js,testing.css} build/common/ | tee -a "$BUILD_LOG"

echo "Build success" | tee -a "$BUILD_LOG"
