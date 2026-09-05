/**
 * Corpus generator — fully synthetic, deterministic, byte-reproducible.
 *
 * Produces the exact PDF corpus filemorf.com/lab benchmarks against:
 * seeded pseudo-random text via mulberry32, fixed PDF metadata dates, so
 * every run on every machine regenerates identical bytes.
 *
 *   npm run corpus                 generate into corpus/files/ and VERIFY
 *                                  every byte against corpus-manifest.json
 *                                  (exits 1 on any drift)
 *   npm run corpus:write-manifest  regenerate the manifest itself (only for
 *                                  deliberate corpus changes)
 *
 * The same manifest is published at
 * https://filemorf.com/lab/corpus-manifest.json — the hashes must agree.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CORPUS_DIR = path.join(ROOT, "corpus", "files");
const MANIFEST_PATH = path.join(ROOT, "corpus-manifest.json");

const WORDS = (
  "file convert merge split page document archive export browser local " +
  "private batch output format layout margin duplex ledger sample corpus " +
  "measure verify receipt workflow recipe morph render text vector raster"
).split(" ");

// Deterministic PRNG (mulberry32) so every run regenerates identical bytes.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function makeTextPdf(pages: number, seed: number): Promise<Uint8Array> {
  const rand = mulberry32(seed);
  const doc = await PDFDocument.create();
  // Deterministic output requires fixed metadata — pdf-lib stamps creation
  // dates otherwise, which would change the hashes on every run.
  doc.setTitle(`FileMorf Lab corpus (seed ${seed})`);
  doc.setProducer("FileMorf Conversion Lab");
  doc.setCreator("filemorf-lab");
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let p = 0; p < pages; p++) {
    const page = doc.addPage([612, 792]); // US Letter
    for (let line = 0; line < 34; line++) {
      const wordCount = 8 + Math.floor(rand() * 5);
      const text = Array.from(
        { length: wordCount },
        () => WORDS[Math.floor(rand() * WORDS.length)]
      ).join(" ");
      page.drawText(text, {
        x: 54,
        y: 748 - line * 20,
        size: 11,
        font,
      });
    }
  }

  return doc.save();
}

interface ManifestEntry {
  file: string;
  pages: number;
  bytes: number;
  sha256: string;
  seed: number;
}

async function main(): Promise<void> {
  const writeManifest = process.argv.includes("--write-manifest");
  await mkdir(CORPUS_DIR, { recursive: true });
  const manifest: ManifestEntry[] = [];

  const write = async (name: string, pages: number, seed: number) => {
    const bytes = await makeTextPdf(pages, seed);
    await writeFile(path.join(CORPUS_DIR, name), bytes);
    manifest.push({
      file: name,
      pages,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      seed,
    });
  };

  await write("text-005.pdf", 5, 1005);
  await write("text-020.pdf", 20, 1020);
  await write("text-100.pdf", 100, 1100);
  for (let i = 0; i < 50; i++) {
    await write(`merge-${String(i).padStart(2, "0")}.pdf`, 3, 2000 + i);
  }

  if (writeManifest) {
    await writeFile(
      MANIFEST_PATH,
      `${JSON.stringify(
        {
          schema: "filemorf-lab-corpus/1",
          description:
            "Fully synthetic, seeded PDF corpus for the FileMorf Conversion Lab. Regenerate byte-identically with corpus/generate.mts.",
          files: manifest,
        },
        null,
        2
      )}\n`
    );
    console.log(`Manifest rewritten for ${manifest.length} files.`);
    return;
  }

  // Default mode is generate-and-VERIFY: the committed manifest is the
  // ground truth, and it must also match what filemorf.com/lab publishes.
  const committed = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as {
    files: ManifestEntry[];
  };
  const expected = new Map(committed.files.map((entry) => [entry.file, entry]));
  let drift = 0;

  for (const entry of manifest) {
    const want = expected.get(entry.file);
    if (!want) {
      console.error(`DRIFT: ${entry.file} generated but absent from manifest`);
      drift += 1;
    } else if (want.sha256 !== entry.sha256 || want.bytes !== entry.bytes) {
      console.error(
        `DRIFT: ${entry.file} sha256 ${entry.sha256.slice(0, 12)}… != manifest ${want.sha256.slice(0, 12)}…`
      );
      drift += 1;
    }
  }
  for (const file of expected.keys()) {
    if (!manifest.some((entry) => entry.file === file)) {
      console.error(`DRIFT: ${file} in manifest but not generated`);
      drift += 1;
    }
  }

  if (drift > 0) {
    console.error(
      `\nCorpus verification FAILED: ${drift} file(s) differ from corpus-manifest.json.`
    );
    process.exit(1);
  }
  console.log(
    `Corpus verified: ${manifest.length} files regenerate byte-identically to corpus-manifest.json.`
  );
}

await main();
