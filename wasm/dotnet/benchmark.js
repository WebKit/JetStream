class Benchmark {
    async init() {
        const config = {
            mainAssemblyName: "dotnet.dll",
            globalizationMode: "custom",
            assets: [
                {
                    name: "dotnet.runtime.js",
                    resolvedUrl:  JetStream.preload.dotnetRuntimeUrl,
                    moduleExports: await JetStream.dynamicImport(JetStream.preload.dotnetRuntimeUrl),
                    behavior: "js-module-runtime"
                },
                {
                    name: "dotnet.native.js",
                    resolvedUrl:  JetStream.preload.dotnetNativeUrl,
                    moduleExports: await JetStream.dynamicImport(JetStream.preload.dotnetNativeUrl),
                    behavior: "js-module-native"
                },
                {
                    name: "dotnet.native.wasm",
                    resolvedUrl:  JetStream.preload.wasmBinaryUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.wasmBinaryUrl),
                    behavior: "dotnetwasm"
                },
                {
                    name: "icudt_CJK.dat",
                    resolvedUrl:  JetStream.preload.icuCustomUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.icuCustomUrl),
                    behavior: "icu"
                },
                {
                    name: "System.Collections.Concurrent.wasm",
                    resolvedUrl:  JetStream.preload.dllCollectionsConcurrentUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllCollectionsConcurrentUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Collections.wasm",
                    resolvedUrl:  JetStream.preload.dllCollectionsUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllCollectionsUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.Primitives.wasm",
                    resolvedUrl:  JetStream.preload.dllComponentModelPrimitivesUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllComponentModelPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ComponentModel.TypeConverter.wasm",
                    resolvedUrl:  JetStream.preload.dllComponentModelTypeConverterUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllComponentModelTypeConverterUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.Primitives.wasm",
                    resolvedUrl:  JetStream.preload.dllDrawingPrimitivesUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllDrawingPrimitivesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Drawing.wasm",
                    resolvedUrl:  JetStream.preload.dllDrawingUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllDrawingUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.IO.Pipelines.wasm",
                    resolvedUrl:  JetStream.preload.dllIOPipelinesUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllIOPipelinesUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Linq.wasm",
                    resolvedUrl:  JetStream.preload.dllLinqUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllLinqUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Memory.wasm",
                    resolvedUrl:  JetStream.preload.dllMemoryUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllMemoryUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.ObjectModel.wasm",
                    resolvedUrl:  JetStream.preload.dllObjectModelUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllObjectModelUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Private.CoreLib.wasm",
                    resolvedUrl:  JetStream.preload.dllPrivateCorelibUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllPrivateCorelibUrl),
                    behavior: "assembly",
                    isCore: true
                },
                {
                    name: "System.Runtime.InteropServices.JavaScript.wasm",
                    resolvedUrl:  JetStream.preload.dllRuntimeInteropServicesJavaScriptUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllRuntimeInteropServicesJavaScriptUrl),
                    behavior: "assembly",
                    isCore: true
                },
                {
                    name: "System.Text.Encodings.Web.wasm",
                    resolvedUrl:  JetStream.preload.dllTextEncodingsWebUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllTextEncodingsWebUrl),
                    behavior: "assembly"
                },
                {
                    name: "System.Text.Json.wasm",
                    resolvedUrl:  JetStream.preload.dllTextJsonUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllTextJsonUrl),
                    behavior: "assembly"
                },
                {
                    name: "dotnet.wasm",
                    resolvedUrl:  JetStream.preload.dllAppUrl,
                    buffer: await JetStream.getBinary(JetStream.preload.dllAppUrl),
                    behavior: "assembly",
                    isCore: true
                }
            ]
        };

        this.dotnet = (await JetStream.dynamicImport(JetStream.preload.dotnetUrl)).dotnet;
        this.api = await this.dotnet.withModuleConfig({ locateFile: e => e }).withConfig(config).create();
        this.exports = await this.api.getAssemblyExports("dotnet.dll");

        this.hardwareConcurrency = 1;
        this.sceneWidth = dotnetFlavor === "aot" ? 300 : 150;
        this.sceneHeight = dotnetFlavor === "aot" ? 200 : 100;
    }
    async runIteration() {
        await this.exports.Interop.RunIteration(this.sceneWidth, this.sceneHeight, this.hardwareConcurrency);
    }
}