#!/bin/bash

set -eo pipefail

# Cleanup old files.
rm -rf 8bitbench/
rm -rf build/

touch build.log
BUILD_LOG="$(realpath build.log)"

echo -e "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee "$BUILD_LOG"

echo "Toolchain versions" | tee -a "$BUILD_LOG"
rustc --version | tee -a "$BUILD_LOG"
cargo --version | tee -a "$BUILD_LOG"
wasm-pack --version | tee -a "$BUILD_LOG"

echo -e "Getting sources..." | tee -a "$BUILD_LOG"
git clone -q https://github.com/justinmichaud/8bitbench.git 2>&1 | tee -a "$BUILD_LOG"
pushd 8bitbench/
git checkout -q 78938b5d3c54fe4b5e3c16b8c52064a95775fb9c
git log -1 --oneline | tee -a "$BUILD_LOG"

echo "Building..." | tee -a "$BUILD_LOG"
pushd rust/
# Update wasm-bindgen to a version compatible with newer rustc (>= 0.2.88).
# Pin the exact version so that rebuilds produce the same glue code.
cargo update -p wasm-bindgen --precise 0.2.129
# Emulator itself.
# NOTE: The 8bitbench README uses `--target web`, but that produces an ES6
# module, so we use the `no-modules` here (which produces almost the same code).
wasm-pack build --target no-modules --release
popd
pushd assets/
pushd cc65/
# Compiler, assembler, linker etc. for the program ROM.
make all
popd
pushd tutorial
# Program ROM to run on the emulator.
make
popd
popd
popd

echo "Copying files from 8bitbench/ into build/" | tee -a "$BUILD_LOG"
mkdir -p build/{lib/fast-text-encoding-1.0.3/,rust/pkg/,assets/}
cp 8bitbench/rust/pkg/{emu_bench.js,emu_bench_bg.wasm} build/rust/pkg
cp 8bitbench/assets/tutorial/full_game.bin build/assets/program.bin

echo "Build success" | tee -a "$BUILD_LOG"
