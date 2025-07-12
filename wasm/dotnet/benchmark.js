class Benchmark {
    async init() {
        const config = {
            mainAssemblyName: "dotnet.dll",
            globalizationMode: "custom",
            assets: [
                {
                    name: "dotnet.runtime.js",
                    resolvedUrl: dotnetRuntimeUrl,
                    moduleExports: await dynamicImport(dotnetRuntimeUrl),
                    behavior: "js-module-runtime"
                },
                {
                    name: "dotnet.native.js",
                    resolvedUrl: dotnetNativeUrl,
                    moduleExports: await dynamicImport(dotnetNativeUrl),
                    behavior: "js-module-native"
                },
                {
                    name: "dotnet.native.wasm",
                    resolvedUrl: wasmBinaryUrl,
                    buffer: await getBinary(wasmBinaryUrl),
                    behavior: "dotnetwasm"
                },
                {
                    name: "icudt_CJK.dat",
                    resolvedUrl: icuCustomUrl,
                    buffer: await getBinary(icuCustomUrl),
                    behavior: "icu"
                },
                {
                    name: "System.Collections.Concurrent.wasm",
                    resolvedUrl: dllCollectionsConcurrentUrl,
                    buffer: await getBinary(dllCollectionsConcurrentUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Collections.wasm",
                    resolvedUrl: dllCollectionsUrl,
                    buffer: await getBinary(dllCollectionsUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.Primitives.wasm",
                    resolvedUrl: dllComponentModelPrimitivesUrl,
                    buffer: await getBinary(dllComponentModelPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.TypeConverter.wasm",
                    resolvedUrl: dllComponentModelTypeConverterUrl,
                    buffer: await getBinary(dllComponentModelTypeConverterUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.Primitives.wasm",
                    resolvedUrl: dllDrawingPrimitivesUrl,
                    buffer: await getBinary(dllDrawingPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.wasm",
                    resolvedUrl: dllDrawingUrl,
                    buffer: await getBinary(dllDrawingUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.IO.Pipelines.wasm",
                    resolvedUrl: dllIOPipelinesUrl,
                    buffer: await getBinary(dllIOPipelinesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Linq.wasm",
                    resolvedUrl: dllLinqUrl,
                    buffer: await getBinary(dllLinqUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Memory.wasm",
                    resolvedUrl: dllMemoryUrl,
                    buffer: await getBinary(dllMemoryUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ObjectModel.wasm",
                    resolvedUrl: dllObjectModelUrl,
                    buffer: await getBinary(dllObjectModelUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Private.CoreLib.wasm",
                    resolvedUrl: dllPrivateCorelibUrl,
                    buffer: await getBinary(dllPrivateCorelibUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Runtime.InteropServices.JavaScript.wasm",
                    resolvedUrl: dllRuntimeInteropServicesJavaScriptUrl,
                    buffer: await getBinary(dllRuntimeInteropServicesJavaScriptUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Text.Encodings.Web.wasm",
                    resolvedUrl: dllTextEncodingsWebUrl,
                    buffer: await getBinary(dllTextEncodingsWebUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Text.Json.wasm",
                    resolvedUrl: dllTextJsonUrl,
                    buffer: await getBinary(dllTextJsonUrl),
                    behavior: "assembly"
                },
                {
                    name: "dotnet.wasm",
                    resolvedUrl: dllAppUrl,
                    buffer: await getBinary(dllAppUrl),
                    behavior: "assembly"
                }
            ]
        };

        this.dotnet = (await dynamicImport(dotnetUrl)).dotnet;
        this.api = await this.dotnet.withModuleConfig({ locateFile: e => e }).withConfig(config).create();
        this.exports = await this.api.getAssemblyExports("dotnet.dll");
        
        this.hardwareConcurrency = globalThis.navigator?.hardwareConcurrency ?? 1;
        this.sceneWidth = dotnetFlavor === "aot" ? 300 : 150;
        this.sceneHeight = dotnetFlavor === "aot" ? 200 : 100;
    }
    async runIteration() {
        await this.exports.Interop.RunIteration(this.sceneWidth, this.sceneHeight, this.hardwareConcurrency);
    }
}