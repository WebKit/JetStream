import {
  addPageNumbers,
  extractPages,
  mergePdfs,
  splitPdf,
  watermarkPdf,
} from "./vendor/pdf-converters.js";

const MERGE_FILES = Array.from(
  { length: 50 },
  (_, i) => "merge-" + String(i).padStart(2, "0") + ".pdf"
);

async function pageCountOf(blob) {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(await blob.arrayBuffer());
  return doc.getPageCount();
}

async function gatePdfPages(blobs, expectations) {
  if (blobs.length !== expectations.blobs) {
    return {
      pass: false,
      detail: `expected ${expectations.blobs} output(s), got ${blobs.length}`,
    };
  }
  let total = 0;
  for (const blob of blobs) {
    if (blob.size === 0) {
      return { pass: false, detail: "empty output blob" };
    }
    const pages = await pageCountOf(blob);
    total += pages;
    if (
      expectations.pagesEach !== undefined &&
      pages !== expectations.pagesEach
    ) {
      return {
        pass: false,
        detail: `output has ${pages} pages, expected ${expectations.pagesEach}`,
      };
    }
  }
  if (
    expectations.pagesTotal !== undefined &&
    total !== expectations.pagesTotal
  ) {
    return {
      pass: false,
      detail: `outputs total ${total} pages, expected ${expectations.pagesTotal}`,
    };
  }
  return {
    pass: true,
    detail: `${blobs.length} output(s), ${total} page(s), all parse`,
  };
}

function mergeBench(count) {
  return {
    id: `merge-${count}`,
    group: "Merging",
    label: `Merge ${count} PDFs`,
    description: `mergePdfs() over ${count} three-page documents.`,
    inputSummary: `${count} PDFs × 3 pages`,
    inputs: MERGE_FILES.slice(0, count),
    run: async (files) => {
      const result = await mergePdfs(files);
      return {
        outputBytes: result.blob.size,
        outputFiles: 1,
        blobs: [result.blob],
      };
    },
    gate: (outcome) =>
      gatePdfPages(outcome.blobs, { blobs: 1, pagesEach: count * 3 }),
  };
}

export const SPECS = {
  "merge-2": mergeBench(2),
  "merge-10": mergeBench(10),
  "merge-50": mergeBench(50),
  "split-20": {
    id: "split-20",
    group: "Splitting & extraction",
    label: "Split a 20-page PDF into single pages",
    description: "splitPdf() with no range — one output document per page.",
    inputSummary: "1 PDF × 20 pages",
    inputs: ["text-020.pdf"],
    run: async ([file]) => {
      const result = await splitPdf(file);
      return {
        outputBytes: result.blobs.reduce((sum, item) => sum + item.blob.size, 0),
        outputFiles: result.blobs.length,
        blobs: result.blobs.map((item) => item.blob),
      };
    },
    gate: (outcome) =>
      gatePdfPages(outcome.blobs, { blobs: 20, pagesEach: 1 }),
  },
  
  "extract-5-of-100": {
    id: "extract-5-of-100",
    group: "Splitting & extraction",
    label: "Extract pages 1–5 from a 100-page PDF",
    description: 'extractPages() with the range "1-5".',
    inputSummary: "1 PDF × 100 pages",
    inputs: ["text-100.pdf"],
    run: async ([file]) => {
      const result = await extractPages(file, "1-5");
      return {
        outputBytes: result.blob.size,
        outputFiles: 1,
        blobs: [result.blob],
      };
    },
    gate: (outcome) => gatePdfPages(outcome.blobs, { blobs: 1, pagesEach: 5 }),
  }
};
