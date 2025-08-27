#! /bin/sh

# Expects to have .NET SDK 9.0.3xx,
# downloadable from using https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-win-x64.zip or https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-linux-x64.tar.gz
# Then run (on macOS and probably Linux this requires sudo) idk how it works on Windows.
# `sudo dotnet workload install wasm-tools`

rm -r ./build-interp ./build-aot build.log

touch build.log
BUILD_LOG="$(realpath build.log)"

echo "Built on $(date -u '+%Y-%m-%dT%H:%M:%SZ')\n" | tee -a "$BUILD_LOG"
echo "Toolchain versions" | tee -a "$BUILD_LOG"
dotnet --version | tee -a "$BUILD_LOG"

dotnet workload install wasm-tools
echo "Building interp..." | tee -a "$BUILD_LOG"
dotnet publish -o ./build-interp ./src/dotnet/dotnet.csproj

# Workaround for `jsc` CLI
printf '%s\n' 'import.meta.url ??= "";' | cat - ./src/dotnet/bin/Release/net9.0/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-interp/wwwroot/_framework/dotnet.js
echo "Copying symbol maps..." | tee -a "$BUILD_LOG"
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-interp/wwwroot/_framework/

echo "Building aot..." | tee -a "$BUILD_LOG"
dotnet publish -o ./build-aot ./src/dotnet/dotnet.csproj -p:RunAOTCompilation=true

# Workaround for `jsc` CLI
printf '%s\n' 'import.meta.url ??= "";' | cat - ./build-aot/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-aot/wwwroot/_framework/dotnet.js
echo "Copying symbol maps..." | tee -a "$BUILD_LOG"
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-aot/wwwroot/_framework/
