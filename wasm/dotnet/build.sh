#! /bin/sh

# Expects to have .NET SDK 9.0.3xx,
# downloadable from using https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-win-x64.zip or https://aka.ms/dotnet/9.0.3xx/daily/dotnet-sdk-linux-x64.tar.gz

dotnet workload install wasm-tools
dotnet publish -o ./build-interp ./src/dotnet/dotnet.csproj
printf '%s\n' 'import.meta.url ??= "";' | cat - ./build-interp/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-interp/wwwroot/_framework/dotnet.js
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-interp/wwwroot/_framework/

dotnet publish -o ./build-aot ./src/dotnet/dotnet.csproj -p:RunAOTCompilation=true
printf '%s\n' 'import.meta.url ??= "";' | cat - ./build-aot/wwwroot/_framework/dotnet.js > temp.js && mv temp.js ./build-aot/wwwroot/_framework/dotnet.js
cp ./src/dotnet/obj/Release/net9.0/wasm/for-publish/dotnet.native.js.symbols ./build-aot/wwwroot/_framework/