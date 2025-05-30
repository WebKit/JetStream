class Benchmark {
    async init() {
        async function fetchBin(name) {
            return new Uint8Array(await (await fetch(name)).arrayBuffer());
        }

        const config = {
            mainAssemblyName: "dotnet.dll",
            globalizationMode: "custom",
            assets: [
                {
                    name: "dotnet.runtime.js",
                    resolvedUrl: dotnetRuntimeUrl,
                    moduleExports: await import(dotnetRuntimeUrl),
                    behavior: "js-module-runtime"
                },
                {
                    name: "dotnet.native.js",
                    resolvedUrl: dotnetNativeUrl,
                    moduleExports: await import(dotnetNativeUrl),
                    behavior: "js-module-native"
                },
                {
                    name: "dotnet.native.wasm",
                    resolvedUrl: wasmBinaryUrl,
                    buffer: await fetchBin(wasmBinaryUrl),
                    behavior: "dotnetwasm"
                },
                {
                    name: "icudt_CJK.dat",
                    resolvedUrl: icuCustomUrl,
                    buffer: await fetchBin(icuCustomUrl),
                    behavior: "icu"
                },
                {
                    name: "System.Collections.Concurrent.wasm",
                    resolvedUrl: dllCollectionsConcurrentUrl,
                    buffer: await fetchBin(dllCollectionsConcurrentUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Collections.wasm",
                    resolvedUrl: dllCollectionsUrl,
                    buffer: await fetchBin(dllCollectionsUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.Primitives.wasm",
                    resolvedUrl: dllComponentModelPrimitivesUrl,
                    buffer: await fetchBin(dllComponentModelPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.TypeConverter.wasm",
                    resolvedUrl: dllComponentModelTypeConverterUrl,
                    buffer: await fetchBin(dllComponentModelTypeConverterUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.Primitives.wasm",
                    resolvedUrl: dllDrawingPrimitivesUrl,
                    buffer: await fetchBin(dllDrawingPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.wasm",
                    resolvedUrl: dllDrawingUrl,
                    buffer: await fetchBin(dllDrawingUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.IO.Pipelines.wasm",
                    resolvedUrl: dllIOPipelinesUrl,
                    buffer: await fetchBin(dllIOPipelinesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Linq.wasm",
                    resolvedUrl: dllLinqUrl,
                    buffer: await fetchBin(dllLinqUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Memory.wasm",
                    resolvedUrl: dllMemoryUrl,
                    buffer: await fetchBin(dllMemoryUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ObjectModel.wasm",
                    resolvedUrl: dllObjectModelUrl,
                    buffer: await fetchBin(dllObjectModelUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Private.CoreLib.wasm",
                    resolvedUrl: dllPrivateCorelibUrl,
                    buffer: await fetchBin(dllPrivateCorelibUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Runtime.InteropServices.JavaScript.wasm",
                    resolvedUrl: dllRuntimeInteropServicesJavaScriptUrl,
                    buffer: await fetchBin(dllRuntimeInteropServicesJavaScriptUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Text.Encodings.Web.wasm",
                    resolvedUrl: dllTextEncodingsWebUrl,
                    buffer: await fetchBin(dllTextEncodingsWebUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Text.Json.wasm",
                    resolvedUrl: dllTextJsonUrl,
                    buffer: await fetchBin(dllTextJsonUrl),
                    behavior: "assembly"
                },
                {
                    name: "dotnet.wasm",
                    resolvedUrl: dllAppUrl,
                    buffer: await fetchBin(dllAppUrl),
                    behavior: "assembly"
                }
            ]
        };

        this.dotnet = (await import(dotnetUrl)).dotnet;
        this.api = await this.dotnet.withModuleConfig({ locateFile: e => e }).withConfig(config).create();
        this.exports = await this.api.getAssemblyExports("dotnet.dll");
        
        if (globalThis.dotnetBenchmarkName == "traytracer") {
            this.exports.MainJS.PrepareToRender(320, 240, globalThis.navigator.hardwareConcurrency);
            await this.exports.MainJS.Render(true);
        } else {
            await this.exports.BenchInterop.PrepareTask(globalThis.dotnetBenchmarkName);
        }
    }
    async runIteration() {
        if (globalThis.dotnetBenchmarkName == "traytracer") {
            await this.exports.MainJS.Render(false);
        } else {
            await this.exports.BenchInterop.Run();
        }
    }
}