#!/bin/bash

set -eo pipefail

# Dart 3.14 emits standard Wasm exception handling (`try_table`) by default
# (https://github.com/dart-lang/sdk/issues/54394).
# TODO: Switch DART_CHANNEL="stable" and DART_SDK_VERSION="3.14.0" once Dart
# 3.14 stable ships.
DART_CHANNEL="beta"
DART_SDK_VERSION="3.14.0-315.3.beta"
FLUTE_COMMIT="712764b186549d919a31d2fc8cc9da4e9a633eb3"

# Cleanup old files.
rm -rf flute/ dart-sdk/ dartsdk.zip
rm -rf build/

BUILD_LOG="$(realpath build.log)"
echo -e "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')" | tee "$BUILD_LOG"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) DART_PLATFORM="linux-x64" ;;
  Linux-aarch64) DART_PLATFORM="linux-arm64" ;;
  Darwin-x86_64) DART_PLATFORM="macos-x64" ;;
  Darwin-arm64) DART_PLATFORM="macos-arm64" ;;
  *) echo "Unsupported platform: $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac

echo "Downloading Dart SDK $DART_SDK_VERSION ($DART_PLATFORM)..." | tee -a "$BUILD_LOG"
curl -sSf -o dartsdk.zip "https://storage.googleapis.com/dart-archive/channels/$DART_CHANNEL/release/$DART_SDK_VERSION/sdk/dartsdk-$DART_PLATFORM-release.zip"
unzip -q dartsdk.zip
rm dartsdk.zip
DART_BIN="$(realpath dart-sdk/bin/dart)"
"$DART_BIN" --disable-analytics >/dev/null 2>&1 || true

echo "Toolchain versions" | tee -a "$BUILD_LOG"
"$DART_BIN" --version 2>&1 | tee -a "$BUILD_LOG"

echo "Getting sources..." | tee -a "$BUILD_LOG"
git clone -q https://github.com/dart-lang/flute.git flute 2>&1 | tee -a "$BUILD_LOG"
pushd flute/
git checkout -q "$FLUTE_COMMIT"
echo "flute commit:" | tee -a "$BUILD_LOG"
git log -1 --oneline | tee -a "$BUILD_LOG"

pushd benchmarks/
echo "Getting Dart dependencies..." | tee -a "$BUILD_LOG"
"$DART_BIN" pub get 2>&1 | tee -a "$BUILD_LOG"

# Same flags as `wasm_gc_benchmarks/compile.sh`, which built the JetStream 3.0
# binaries. -O2 is also what `flutter build web --wasm` uses for release builds,
# and --no-strip-wasm keeps the name section for profiling.
mkdir -p ../../build/
echo "Compiling flute.complex to wasm..." | tee -a "$BUILD_LOG"
"$DART_BIN" compile wasm -Ddart.vm.product=true -O2 --no-strip-wasm -o ../../build/flute.complex.dart2wasm.wasm lib/complex.dart 2>&1 | tee -a "$BUILD_LOG"

echo "Compiling flute.todomvc to wasm..." | tee -a "$BUILD_LOG"
"$DART_BIN" compile wasm -Ddart.vm.product=true -O2 --no-strip-wasm -o ../../build/flute.todomvc.dart2wasm.wasm lib/todomvc.dart 2>&1 | tee -a "$BUILD_LOG"
popd
popd

# The benchmark only needs the .wasm and .mjs files.
rm -f build/*.support.js build/*.wasm.map

echo "Build success" | tee -a "$BUILD_LOG"
