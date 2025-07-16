// Copyright 2025 Nutrient. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

function getSingleJsonReplyFromResult(result) {
  if (result.getRepliesCount() !== 1) {
    throw new Error(
      `Expected 1 reply, but got ${result.getRepliesCount()} replies`
    );
  }
  if (!result.hasJSONReply(0)) {
    throw new Error("Expected JSON reply");
  }
  return JSON.parse(result.getJSONReply(0));
}

function setupPrerequisites() {
  Module.ENVIRONMENT_IS_SHELL =
    typeof document === "undefined" && typeof window === "undefined";
  Module.ENVIRONMENT_IS_WEB = !Module.ENVIRONMENT_IS_SHELL;

  if (Module.ENVIRONMENT_IS_SHELL) {
    // Nutrient WASM requires a location to be set. In shell mode, this isn't available by default.
    if (!globalThis.location) {
      globalThis.location = {
        origin: "http://localhost:8010",
        href: "http://localhost:8010/index.html",
        protocol: "http:",
        host: "localhost:8010",
        hostname: "localhost",
        port: "8010",
        pathname: "/",
        search: "",
        hash: "",
      };
    }

    if (!globalThis.crypto) {
      globalThis.crypto = {};
    }
    if (!globalThis.crypto.getRandomValues) {
      globalThis.crypto.getRandomValues = function (array) {
        if (
          !(
            array instanceof Int8Array ||
            array instanceof Uint8Array ||
            array instanceof Int16Array ||
            array instanceof Uint16Array ||
            array instanceof Int32Array ||
            array instanceof Uint32Array ||
            array instanceof Uint8ClampedArray
          )
        )
          throw new TypeError("Expected an integer array");

        if (array.byteLength > 65536)
          throw new RangeError("Can only request a maximum of 65536 bytes");

        var i = 0,
          r;

        for (; i < array.length; i++) {
          if ((i & 0x03) === 0) r = Math.random() * 0x100000000;
          array[i] = (r >>> ((i & 0x03) << 3)) & 0xff;
        }

        return array;
      };
    }
  }
}

async function initializeNutrient() {
  await PSPDFModuleInit(Module);

  const rawResult = await Module.initPSPDFKit(
    "", // License key - not required.
    "JetStream", // Origin - not required.
    "", // Fonts path - not required.
    "", // Analytics - not required.
    "NodeJS", // Environment - "NodeJS" also works in the browser.
    JSON.stringify([]) // Feature flags - not required.
  );

  const result = JSON.parse(rawResult);
  if (!result.success) {
    throw new Error("Failed to initialize Nutrient: " + result.error);
  }
}

function openDocument(path) {
  const result = Module.openDocument(
    path,
    JSON.stringify({
      password: undefined,
      initialPageIndex: undefined,
    })
  );

  // Check if document loading failed
  if (result && result.error) {
    throw new Error("Document loading failed:", result.error);
  }
}

function renderPage(pageIndex, width, height) {
  const result = Module.dispatchCommand(
    JSON.stringify({
      type: "render_page",
      page: pageIndex,
      format: "png",
      page_width: width,
      page_height: height,
    })
  );

  if (result && result.hasError()) {
    throw new Error("Failed to render page: " + result.getErrorMessage());
  }

  if (result.getRepliesCount() !== 1) {
    throw new Error(
      `Expected 1 reply, but got ${result.getRepliesCount()} replies`
    );
  }

  if (!result.hasBinaryReply(0)) {
    throw new Error("Expected binary reply for rendered page");
  }
}

function importInstantJSON(json) {
  const uint = new Uint8Array(json.buffer);
  const memoryHandle = Module.allocateMemory(uint.byteLength);

  try {
    memoryHandle.view.set(uint);
    const vector = Module.memoryHandleToVector(memoryHandle);

    try {
      result = Module.dispatchCommandWithBinary(
        JSON.stringify({ type: "import_document_json" }),
        vector
      );
    } finally {
      vector.delete();
    }
  } finally {
    memoryHandle.delete();
  }

  if (result && result.hasError()) {
    throw new Error(
      "Failed to import Document JSON: " + result.getErrorMessage()
    );
  }
}

function renderAnnotation(annotationId) {
  const result = Module.dispatchCommand(
    JSON.stringify({
      type: "render_annotation",
      annotation_id: annotationId,
      page: 0,
      format: "png",
      bitmap_width: 350,
      bitmap_height: 250,
    })
  );

  if (result && result.hasError()) {
    throw new Error("Failed to render annotation: " + result.getErrorMessage());
  }
}

// `getContentTree` retrieves the page text and accessibility tree for a given page index.
function getContentTree(pageIndex) {
  const result = Module.dispatchCommand(
    JSON.stringify({
      type: "get_content_tree",
      pageIndex: pageIndex,
    })
  );

  if (result && result.hasError()) {
    throw new Error("Failed to get content tree: " + result.getErrorMessage());
  }

  return getSingleJsonReplyFromResult(result);
}

function verifyContentTree(contentTree) {
  if (
    !contentTree ||
    !Array.isArray(contentTree.nodes) ||
    contentTree.nodes.length === 0
  ) {
    throw new Error("Content tree is empty or not an array");
  }
}

function getAnnotations() {
  const result = Module.dispatchCommand(
    JSON.stringify({
      type: "get_annotations",
      skip_attachments: true,
    })
  );

  if (result && result.hasError()) {
    throw new Error("Failed to get annotations: " + result.getErrorMessage());
  }

  const annotations = [];
  for (let i = 0; i < result.getRepliesCount(); i++) {
    if (result.hasJSONReply(i)) {
      annotations.push(JSON.parse(result.getJSONReply(i)));
    } else {
      throw new Error(`Expected JSON reply for annotation ${i}`);
    }
  }
  return annotations;
}

// Page width and height for the assets/example.pdf document.
const PAGE_WIDTH = 1190;
const PAGE_HEIGHT = 841;

class Benchmark {
  async init() {
    Module.wasmBinary = await getBinary(wasmBinary);
    Module.annotations = await getBinary(annotations);

    setupPrerequisites();
    injectRequiredGlobals(globalThis);
  }

  async runIteration() {
    if (!Module.initPSPDFKit) {
      await initializeNutrient();

      Module.FS.writeFile("/document.pdf", await getBinary(pdfDocument));
    }

    openDocument("/document.pdf");

    importInstantJSON(Module.annotations);
    const annotations = getAnnotations();
    if (annotations.length !== 9) {
      throw new Error(`Expected 9 annotations, but got ${annotations.length}`);
    }

    var renderScale = 0.3;
    renderPage(0, PAGE_WIDTH * renderScale, PAGE_HEIGHT * renderScale);
    renderPage(1, PAGE_WIDTH * renderScale, PAGE_HEIGHT * renderScale);

    const contentTree0 = getContentTree(0);
    verifyContentTree(contentTree0);
    const contentTree1 = getContentTree(1);
    verifyContentTree(contentTree1);
  }
}
