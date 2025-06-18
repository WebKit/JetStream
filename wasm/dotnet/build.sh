# Download .NET SDK 9.0.300
# Install workload wasm-tools
dotnet publish -o ./build-interp ./src/dotnet/dotnet.csproj
dotnet publish -o ./build-aot ./src/dotnet/dotnet.csproj -p:RunAOTCompilation=true