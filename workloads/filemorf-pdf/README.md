# filemorf-lab

Reproducible benchmarks for in-browser file processing — the complete
harness behind [filemorf.com/lab](https://filemorf.com/lab).

[FileMorf](https://filemorf.com) converts and edits files client-side (the
bytes never leave the device), and its Lab page publishes timings for the
PDF operations it ships. A published number you can't rerun is marketing,
so this repository contains everything needed to reproduce those numbers
from scratch, on your hardware, in real browsers:

- **A byte-reproducible corpus.** `corpus/generate.mts` builds every test
  PDF from seeded pseudo-random text with pinned metadata. Run it anywhere
  and the SHA-256 of every file matches [`corpus-manifest.json`](corpus-manifest.json) —
  the same manifest published at
  [filemorf.com/lab/corpus-manifest.json](https://filemorf.com/lab/corpus-manifest.json).
  No third-party documents, no customer files, nothing you have to trust.
- **The verbatim production code.** [`vendor/pdf-converters.ts`](vendor/pdf-converters.ts)
  is the exact merge/split/extract/page-number/watermark implementation
  filemorf.com ships to browsers (provenance and commit in the file
  header) — not a benchmark-friendly rewrite.
- **Correctness gates before timing.** Every benchmark's outputs are
  structurally verified on an untimed run first — output PDFs must parse,
  page counts must be exact, archives must contain every entry non-empty.
  A benchmark that produces garbage fails; it cannot post a fast time.
- **Real browsers, not proxies.** A Playwright driver injects the bundled
  harness into blank pages in Chromium, Firefox, and WebKit and measures
  with the page's own `performance.now()` — driver/IPC overhead is never
  inside a timing. A Node runner covers the server-side-JS baseline.
- **CI that re-proves it.** Every commit regenerates the corpus, asserts
  byte-identity, and runs the gates in Node and real Chromium on a clean
  runner.

## Results (2026-07-30, Apple M2 Pro)

Median of 30 timed runs after 2 warmups, milliseconds. Full raw data —
every individual timing, p95s, output sizes, environment — in
[`results/`](results/).

| Benchmark | Node 23 | Chromium 151 | Firefox 153 | WebKit 26.5 |
|---|---:|---:|---:|---:|
| `merge-2` — merge 2 PDFs | 1.4 | 1.3 | 2 | 2 |
| `merge-10` — merge 10 PDFs | 4.7 | 4.2 | 7 | 5 |
| `merge-50` — merge 50 PDFs | 29.1 | 37.5 | 60.5 | 24 |
| `split-20` — split 20 pages into 20 files | 5 | 6.4 | 8 | 5 |
| `extract-5-of-100` — extract 5 of 100 pages | 6.4 | 3.6 | 5 | 4.5 |
| `page-numbers-100` — stamp 100 pages | 28.6 | 36.7 | 54 | 15 |
| `watermark-100` — watermark 100 pages | 27.6 | 36.5 | 54 | 14 |
| `zip-50` — package 50 PDFs into a ZIP | 3.1 | 5.9 | 4 | 11 |

Two observations worth stealing even if you never use FileMorf:

- **Client-side PDF manipulation is fast.** The heaviest operation here —
  merging 50 documents or stamping 100 pages — lands under 61 ms in the
  slowest engine on a laptop. For workloads like these, uploading to a
  server costs more in transfer time than the entire computation.
- **Engines differ more than you'd guess.** WebKit runs the 100-page
  stamping operations ~2.4× faster than Chromium and ~3.7× faster than
  Firefox, then loses on ZIP packaging. If you ship compute-heavy JS,
  single-engine numbers are not the truth.

## Reproduce it

```
npm ci
npm run corpus          # generates + verifies byte-identity against the manifest
npm run bench:node      # Node runner, correctness gates + 30 timed runs
npx playwright install chromium firefox webkit
npm run bench:browser   # same benchmarks inside all three real engines
```

`LAB_RUNS=10` lowers the iteration count; `LAB_BROWSERS=chromium` narrows
the engine list. Results land in `results/*-latest.json` (gitignored — the
committed, dated files are the published datasets).

## What exactly is measured

Specs live in [`bench/specs.mts`](bench/specs.mts); the measurement core is
[`bench/harness.mts`](bench/harness.mts) and is identical in Node and in
the page. Per benchmark: one untimed run feeds the correctness gate, two
warmups, then N timed runs; we publish median, p95, min, and every raw
timing. Timer is `performance.now()` in the executing environment.

Libraries under test: [pdf-lib](https://github.com/Hopding/pdf-lib) 1.17.1
and [JSZip](https://github.com/Stuk/jszip) 3.10.1 — pinned exactly, because
the corpus bytes and the timings both depend on them.

## Limitations — read before comparing

- **One machine class so far.** The committed results are a single Apple
  M2 Pro laptop. Your numbers will differ; the point is that you can get
  yours in three commands. PRs adding dated results from other hardware
  are welcome (see `results/` naming).
- **Synthetic, text-only corpus.** No scans, no forms, no encryption, no
  pathological files — this measures the common case, not the adversarial
  one. The corpus is synthetic so it can be public and byte-reproducible.
- **Structural gates, not visual ones.** Gates verify parse-ability, page
  counts, sizes, and archive contents — not pixel-perfect rendering.
  (FileMorf's product test suite separately verifies content, e.g. that a
  watermark's text is actually extractable from every output page.)
- **CI timings are not comparable.** CI exists to re-prove byte-identity
  and correctness on a clean machine; its timings ride along as artifacts
  but shared runners make them meaningless as performance data.
- **Browser timings exclude library download.** The harness is injected
  pre-bundled; real-world first use also pays a one-time fetch of the
  libraries (~250 KB gzipped for FileMorf's PDF stack, cached thereafter).

## Relationship to FileMorf

This harness is why [filemorf.com/lab](https://filemorf.com/lab) says
"measured, not promised" — and the same discipline runs through the
product: FileMorf's [Morfs](https://filemorf.com/morfs) are file workflows
that verify their own outcomes and emit a receipt (input/output SHA-256s,
engine versions, assertion results) after every run.

Code is MIT. The dated result files in `results/` are additionally
released under CC BY 4.0. Questions, corrections, or a benchmark you want
added: open an issue, or support@filemorf.com.
