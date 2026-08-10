/**
 * VENDORED VERBATIM from the FileMorf application source:
 *
 *   src/lib/converters/pdf.ts @ commit 20a7122 (2026-07-30)
 *
 * These are the exact functions filemorf.com ships to browsers for PDF
 * merge, split, extract, page numbering, and watermarking — the code the
 * benchmarks in this repository measure. Nothing here is rewritten or
 * simplified for benchmarking; the only edits are noted stubs for branches
 * the benchmarks never reach (image watermarks, which need the app's image
 * pipeline).
 *
 * To audit the claim, diff any function body against the deployed bundle
 * at filemorf.com or ask FileMorf for the source excerpt at the commit
 * above.
 */
import type { Color, PDFDocument, PDFFont, PDFPage } from "pdf-lib";

type PdfLibModule = typeof import("pdf-lib");
let pdfLibPromise: Promise<PdfLibModule> | null = null;
function loadPdfLib(): Promise<PdfLibModule> {
  pdfLibPromise ??= import("pdf-lib").catch((error) => {
    pdfLibPromise = null;
    throw error;
  });
  return pdfLibPromise;
}

/**
 * Helper to create a Blob from Uint8Array (handles TypeScript strict mode)
 */
function createPdfBlob(data: Uint8Array): Blob {
  // Create a new ArrayBuffer copy to satisfy TypeScript's strict type checking
  const buffer = new ArrayBuffer(data.length);
  const view = new Uint8Array(buffer);
  view.set(data);
  return new Blob([buffer], { type: "application/pdf" });
}

/**
 * Load a PDF with pdf-lib, translating library errors into messages a user
 * can act on.
 */
async function loadPdfDocument(file: File): Promise<PDFDocument> {
  const { PDFDocument } = await loadPdfLib();
  const arrayBuffer = await file.arrayBuffer();

  try {
    return await PDFDocument.load(arrayBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (/encrypted/i.test(message)) {
      throw new Error(
        `"${file.name}" is password-protected. Remove the password (e.g., open it and re-save without encryption) and try again.`
      );
    }

    throw new Error(
      `"${file.name}" doesn't appear to be a valid PDF file. It may be corrupted or renamed from another format.`
    );
  }
}

export interface PdfMergeResult {
  blob: Blob;
  pageCount: number;
  originalTotalSize: number;
  mergedSize: number;
}

export interface PdfSplitResult {
  blobs: { blob: Blob; pageNumber: number; filename: string }[];
  originalSize: number;
}

/**
 * Merge multiple PDF files into a single PDF
 */
export async function mergePdfs(
  files: File[],
  onProgress?: (progress: number) => void
): Promise<PdfMergeResult> {
  if (files.length === 0) {
    throw new Error("No files provided for merging");
  }

  const { PDFDocument } = await loadPdfLib();
  const mergedPdf = await PDFDocument.create();
  let totalOriginalSize = 0;
  const totalFiles = files.length;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    totalOriginalSize += file.size;

    const pdf = await loadPdfDocument(file);
    const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());

    pages.forEach((page) => {
      mergedPdf.addPage(page);
    });

    onProgress?.(((i + 1) / totalFiles) * 90);
  }

  const mergedPdfBytes = await mergedPdf.save();
  const blob = createPdfBlob(mergedPdfBytes);

  onProgress?.(100);

  return {
    blob,
    pageCount: mergedPdf.getPageCount(),
    originalTotalSize: totalOriginalSize,
    mergedSize: blob.size,
  };
}

/**
 * Split a PDF into individual pages or page ranges
 */
export async function splitPdf(
  file: File,
  pageRanges?: string, // e.g., "1-3,5,7-10" or undefined for all pages
  onProgress?: (progress: number) => void
): Promise<PdfSplitResult> {
  const pdf = await loadPdfDocument(file);
  const totalPages = pdf.getPageCount();

  // Parse page ranges or default to all pages
  const pagesToExtract = pageRanges ? parsePageRanges(pageRanges, totalPages) : Array.from({ length: totalPages }, (_, i) => i);

  const results: PdfSplitResult["blobs"] = [];
  const baseName = file.name.replace(/\.pdf$/i, "");
  const { PDFDocument } = await loadPdfLib();

  for (let i = 0; i < pagesToExtract.length; i++) {
    const pageIndex = pagesToExtract[i];

    const newPdf = await PDFDocument.create();
    const [copiedPage] = await newPdf.copyPages(pdf, [pageIndex]);
    newPdf.addPage(copiedPage);

    const pdfBytes = await newPdf.save();
    const blob = createPdfBlob(pdfBytes);

    results.push({
      blob,
      pageNumber: pageIndex + 1,
      filename: `${baseName}_page_${pageIndex + 1}.pdf`,
    });

    onProgress?.(((i + 1) / pagesToExtract.length) * 100);
  }

  return {
    blobs: results,
    originalSize: file.size,
  };
}

/**
 * Extract specific pages from a PDF into a new PDF
 */
export async function extractPages(
  file: File,
  pageRanges: string, // e.g., "1-3,5,7-10"
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; pageCount: number }> {
  const pdf = await loadPdfDocument(file);
  const totalPages = pdf.getPageCount();

  const pagesToExtract = parsePageRanges(pageRanges, totalPages);

  onProgress?.(30);

  const { PDFDocument } = await loadPdfLib();
  const newPdf = await PDFDocument.create();
  const copiedPages = await newPdf.copyPages(pdf, pagesToExtract);

  copiedPages.forEach((page) => {
    newPdf.addPage(page);
  });

  onProgress?.(80);

  const pdfBytes = await newPdf.save();
  const blob = createPdfBlob(pdfBytes);

  onProgress?.(100);

  return {
    blob,
    pageCount: newPdf.getPageCount(),
  };
}

function parsePageRanges(rangeString: string, totalPages: number): number[] {
  const pages: number[] = [];
  const parts = rangeString
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    throw new Error('No pages specified. Use a format like "1-3, 5, 7-10".');
  }

  for (const part of parts) {
    const rangeMatch = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    const singleMatch = /^(\d+)$/.exec(part);

    if (rangeMatch) {
      let start = parseInt(rangeMatch[1], 10);
      let end = parseInt(rangeMatch[2], 10);
      if (start > end) {
        [start, end] = [end, start];
      }
      if (start > totalPages) {
        throw new Error(
          `Pages ${start}-${end} are outside this document — it only has ${totalPages} page${totalPages !== 1 ? "s" : ""}.`
        );
      }
      for (let i = Math.max(1, start); i <= Math.min(end, totalPages); i++) {
        pages.push(i - 1); // Convert to 0-indexed
      }
    } else if (singleMatch) {
      const page = parseInt(singleMatch[1], 10);
      if (page < 1 || page > totalPages) {
        throw new Error(
          `Page ${page} is outside this document — it only has ${totalPages} page${totalPages !== 1 ? "s" : ""}.`
        );
      }
      pages.push(page - 1); // Convert to 0-indexed
    } else {
      throw new Error(
        `"${part}" isn't a valid page or range. Use a format like "1-3, 5, 7-10".`
      );
    }
  }

  if (pages.length === 0) {
    throw new Error(
      `Those pages don't exist in this document — it only has ${totalPages} page${totalPages !== 1 ? "s" : ""}.`
    );
  }

  // Remove duplicates and sort
  return [...new Set(pages)].sort((a, b) => a - b);
}

export type PageNumberPosition =
  | "bottom-center"
  | "bottom-left"
  | "bottom-right"
  | "top-center"
  | "top-left"
  | "top-right";

export type PageNumberFormat = "n" | "n-of-total" | "page-n" | "page-n-of-total";

export interface AddPageNumbersOptions {
  position?: PageNumberPosition;
  format?: PageNumberFormat;
  /** The number printed on the first numbered page. */
  startAt?: number;
  /** Pages to stamp, e.g. "2-10" to skip a cover page. Defaults to all. */
  pageRanges?: string;
  fontSize?: number;
}

function formatPageNumber(
  format: PageNumberFormat,
  n: number,
  total: number
): string {
  switch (format) {
    case "n":
      return `${n}`;
    case "n-of-total":
      return `${n} / ${total}`;
    case "page-n":
      return `Page ${n}`;
    case "page-n-of-total":
      return `Page ${n} of ${total}`;
  }
}

const PAGE_NUMBER_EDGE_MARGIN = 28;

function pageNumberCoords(
  position: PageNumberPosition,
  page: PDFPage,
  textWidth: number,
  fontSize: number
): { x: number; y: number } {
  const { width, height } = page.getSize();
  const y = position.startsWith("top")
    ? height - PAGE_NUMBER_EDGE_MARGIN - fontSize
    : PAGE_NUMBER_EDGE_MARGIN;

  const x = position.endsWith("left")
    ? PAGE_NUMBER_EDGE_MARGIN
    : position.endsWith("right")
      ? width - PAGE_NUMBER_EDGE_MARGIN - textWidth
      : (width - textWidth) / 2;

  return { x, y };
}

/**
 * Stamp page numbers onto a PDF. Runs entirely in the browser; original
 * content is untouched — numbers are drawn on top.
 */
export async function addPageNumbers(
  file: File,
  options: AddPageNumbersOptions = {},
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; pageCount: number }> {
  const {
    position = "bottom-center",
    format = "n",
    startAt = 1,
    pageRanges,
    fontSize = 12,
  } = options;

  const pdf = await loadPdfDocument(file);
  const { StandardFonts, rgb } = await loadPdfLib();
  const totalPages = pdf.getPageCount();
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  const targetIndices = pageRanges
    ? parsePageRanges(pageRanges, totalPages)
    : Array.from({ length: totalPages }, (_, i) => i);

  // "N of total" counts the numbered set, not the whole document, so a
  // skipped cover page doesn't produce "2 of 11" on a 10-page body.
  const totalNumbered = targetIndices.length + startAt - 1;

  targetIndices.forEach((pageIndex, i) => {
    const page = pdf.getPage(pageIndex);
    const n = startAt + i;
    const text = formatPageNumber(format, n, totalNumbered);
    const textWidth = font.widthOfTextAtSize(text, fontSize);
    const { x, y } = pageNumberCoords(position, page, textWidth, fontSize);

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });

    onProgress?.(((i + 1) / targetIndices.length) * 90);
  });

  const pdfBytes = await pdf.save();
  onProgress?.(100);

  return { blob: createPdfBlob(pdfBytes), pageCount: totalPages };
}

// ==========================================
// Watermark
// ==========================================

export type WatermarkLayout = "diagonal" | "center" | "tile";

export interface WatermarkPdfOptions {
  /** Text watermark; ignored when an image is provided. */
  text?: string;
  /** Image watermark (PNG/JPEG). Takes precedence over text. */
  imageFile?: File;
  layout?: WatermarkLayout;
  /** 0-100 */
  opacity?: number;
  fontSize?: number;
  color?: "gray" | "black" | "red" | "blue";
  /** Pages to stamp, e.g. "1-3". Defaults to all. */
  pageRanges?: string;
}

// Raw channel triples (not pdf-lib Color objects) so this table doesn't
// force pdf-lib to load at module evaluation; rgb() is applied at draw time.
const WATERMARK_COLORS = {
  gray: { red: 0.5, green: 0.5, blue: 0.5 },
  black: { red: 0, green: 0, blue: 0 },
  red: { red: 0.8, green: 0.1, blue: 0.1 },
  blue: { red: 0.1, green: 0.3, blue: 0.8 },
} as const;

function drawTextWatermark(
  pdfLib: PdfLibModule,
  page: PDFPage,
  text: string,
  font: PDFFont,
  layout: WatermarkLayout,
  opacity: number,
  fontSize: number,
  color: Color
) {
  const { width, height } = page.getSize();
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const textHeight = font.heightAtSize(fontSize);

  if (layout === "tile") {
    // Diagonal-ish grid: stagger alternate rows for even coverage
    const stepX = textWidth + 96;
    const stepY = textHeight + 120;
    let row = 0;
    for (let y = 0; y < height + stepY; y += stepY) {
      const offset = row % 2 === 0 ? 0 : stepX / 2;
      for (let x = -offset; x < width; x += stepX) {
        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color,
          opacity,
          rotate: pdfLib.degrees(30),
        });
      }
      row += 1;
    }
    return;
  }

  const angle = layout === "diagonal" ? 45 : 0;
  const radians = (angle * Math.PI) / 180;

  // Center of the drawn text after rotation about its baseline start point:
  // offset the anchor so the text's midpoint lands on the page's midpoint.
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const centerOffsetX = (textWidth / 2) * cos - (textHeight / 2) * sin;
  const centerOffsetY = (textWidth / 2) * sin + (textHeight / 2) * cos;

  page.drawText(text, {
    x: width / 2 - centerOffsetX,
    y: height / 2 - centerOffsetY,
    size: fontSize,
    font,
    color,
    opacity,
    rotate: pdfLib.degrees(angle),
  });
}

// LAB STUB — the only non-verbatim line in this file. The application
// implements image-watermark embedding via its image pipeline; the
// benchmarks exercise text watermarks only, so this branch is unreachable
// here and stubs closed rather than silently diverging.
async function toEmbeddableImage(_file: File): Promise<{ bytes: Uint8Array; kind: "jpg" | "png" }> {
  throw new Error("Image watermarks are not part of the lab excerpt.");
}

/**
 * Stamp a text or image watermark across PDF pages. Runs entirely in the
 * browser. Watermarks are drawn over the content (visible on top of images
 * and scans, unlike underlays which scanned pages would hide).
 */
export async function watermarkPdf(
  file: File,
  options: WatermarkPdfOptions,
  onProgress?: (progress: number) => void
): Promise<{ blob: Blob; pageCount: number }> {
  const {
    text,
    imageFile,
    layout = "diagonal",
    opacity = 30,
    fontSize = 48,
    color = "gray",
    pageRanges,
  } = options;

  if (!imageFile && !text?.trim()) {
    throw new Error("Enter watermark text or choose a watermark image.");
  }

  const pdf = await loadPdfDocument(file);
  const pdfLib = await loadPdfLib();
  const totalPages = pdf.getPageCount();
  const opacityValue = Math.min(Math.max(opacity, 1), 100) / 100;

  const targetIndices = pageRanges
    ? parsePageRanges(pageRanges, totalPages)
    : Array.from({ length: totalPages }, (_, i) => i);

  let embeddedImage = null;
  let font: PDFFont | null = null;

  if (imageFile) {
    const { bytes, kind } = await toEmbeddableImage(imageFile);
    embeddedImage =
      kind === "jpg" ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes);
  } else {
    font = await pdf.embedFont(pdfLib.StandardFonts.HelveticaBold);
  }

  for (let i = 0; i < targetIndices.length; i++) {
    const page = pdf.getPage(targetIndices[i]);

    if (embeddedImage) {
      const { width, height } = page.getSize();
      // Scale the image to at most 50% of the page's short side
      const maxSide = Math.min(width, height) * 0.5;
      const scale = Math.min(
        maxSide / embeddedImage.width,
        maxSide / embeddedImage.height,
        1
      );
      const drawWidth = embeddedImage.width * scale;
      const drawHeight = embeddedImage.height * scale;

      if (layout === "tile") {
        const stepX = drawWidth + 72;
        const stepY = drawHeight + 72;
        for (let y = 24; y < height; y += stepY) {
          for (let x = 24; x < width; x += stepX) {
            page.drawImage(embeddedImage, {
              x,
              y,
              width: drawWidth,
              height: drawHeight,
              opacity: opacityValue,
            });
          }
        }
      } else {
        page.drawImage(embeddedImage, {
          x: (width - drawWidth) / 2,
          y: (height - drawHeight) / 2,
          width: drawWidth,
          height: drawHeight,
          opacity: opacityValue,
        });
      }
    } else if (font && text) {
      try {
        drawTextWatermark(
          pdfLib,
          page,
          text.trim(),
          font,
          layout,
          opacityValue,
          fontSize,
          pdfLib.rgb(
            WATERMARK_COLORS[color].red,
            WATERMARK_COLORS[color].green,
            WATERMARK_COLORS[color].blue
          )
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/encode|WinAnsi/i.test(message)) {
          throw new Error(
            "Watermark text contains characters the standard PDF fonts can't encode. Use basic Latin characters, or use an image watermark instead."
          );
        }
        throw error;
      }
    }

    onProgress?.(((i + 1) / targetIndices.length) * 90);
  }

  const pdfBytes = await pdf.save();
  onProgress?.(100);

  return { blob: createPdfBlob(pdfBytes), pageCount: totalPages };
}
