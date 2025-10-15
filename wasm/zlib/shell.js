// zlib-based  utility for use in shells where CompressionStream and
// DecompressionStream are not available.

function module() {
  "use strict";

  let zlibPromise = null;
  let zlibModule = null;

  async function initialize() {
    if (zlibPromise) {
      zlibModule = await zlibPromise;
      return zlibModule;
    }
    load('wasm/zlib/build/zlib.js');
    zlibPromise = setupModule({
      wasmBinary: new Int8Array(read('wasm/zlib/build/zlib.wasm', "binary")),
    });
    zlibModule = await zlibPromise;
    return zlibModule;
  }

  function decompress(bytes) {
    zlibModule.FS.writeFile('in', bytes);
    const inputzStr = zlibModule.stringToNewUTF8('in');
    const inputzoutStr = zlibModule.stringToNewUTF8('out');
    if (zlibModule._decompressFile(inputzStr, inputzoutStr) !== 0) {
      throw new Error();
    }
    const output = zlibModule.FS.readFile('out');
    zlibModule._free(inputzStr);
    zlibModule._free(inputzoutStr);
    return output;
  }

  return {
    initialize: initialize,
    decompress: decompress,
  };
}

globalThis.zlib = module();

