#! /bin/sh

# Expects to have .NET SDK 9.0.3xx with `wasm-tools` installed.
# Installation options:
# A) Download and manually install from https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-win-x64.zip or https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-linux-x64.tar.gz
# B) "Scripted install" as described in
# https://learn.microsoft.com/en-us/dotnet/core/install/linux-scripted-manual#scripted-install:
#   `wget https://dot.net/v1/dotnet-install.sh -O dotnet-install.sh && chmod +x ./dotnet-install.sh`, then
#   `./dotnet-install.sh --channel 9.0` (You must provide the 9.0 channel, otherwise it will install 8.0).
# Finally `sudo dotnet workload install wasm-tools` (without sudo for a user
# installation of dotnet, e.g., with option B above).

rm -r src/dotnet/bin src/dotnet/obj ./build-interp ./build-aot build.log

touch build.log
BUILD_LOG="$(realpath build.log)"

echo "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')\n" | tee -a "$BUILD_LOG"
echo "Toolchain versions" | tee -a "$BUILD_LOG"
dotnet --version | tee -a "$BUILD_LOG"

echo "Building interp..." | tee -a "$BUILD_LOG"
dotnet publish -o ./build-interp ./src/dotnet/dotnet.csproj

# Workaround for `jsc` CLI
printf '%s\n' 'import.meta.url ??= "";' | cat - ./src/dotnet/bin/Release/net9.0/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-interp/wwwroot/_framework/dotnet.js
echo "Copying symbol maps..." | tee -a "$BUILD_LOG"
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-interp/wwwroot/_framework/

# Net9 and Net10 use Emscripten version 3.1.56, which emits legacy EH, see https://github.com/WebKit/JetStream/pull/188
# FIXME: Update toolchain to Net11 once available, then remove this wasm-opt call.
for wasmFile in $(find "./build-interp" -type f -name "*.wasm");
do
    wasm-opt "$wasmFile" --translate-to-exnref --enable-bulk-memory --enable-exception-handling --enable-simd --enable-reference-types --enable-multivalue -o "$wasmFile"
done


echo "Building aot..." | tee -a "$BUILD_LOG"
dotnet publish -o ./build-aot ./src/dotnet/dotnet.csproj -p:RunAOTCompilation=true

# Workaround for `jsc` CLI
printf '%s\n' 'import.meta.url ??= "";' | cat - ./build-aot/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-aot/wwwroot/_framework/dotnet.js
echo "Copying symbol maps..." | tee -a "$BUILD_LOG"
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-aot/wwwroot/_framework/

# Net9 and Net10 use Emscripten version 3.1.56, which emits legacy EH, see https://github.com/WebKit/JetStream/pull/188
# FIXME: Update toolchain to Net11 once available, then remove this wasm-opt call.
for wasmFile in $(find "./build-aot" -type f -name "*.wasm");
do
    wasm-opt "$wasmFile" --translate-to-exnref --enable-bulk-memory --enable-exception-handling --enable-simd --enable-reference-types --enable-multivalue -o "$wasmFile"
done
