#!/usr/bin/env node

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

function parseArgs(argv) {
  const args = {
    input: null,
    out: null,
    baseUrl: process.env.LLAMA_SERVER_URL || 'http://127.0.0.1:8080',
    prompt:
      process.env.OCR_PROMPT ||
      'Extract all visible text in reading order. Return plain text only.',
    model: process.env.OCR_MODEL || undefined,
    dpi: Number(process.env.OCR_PDF_DPI || 220),
    maxPixels: Number(process.env.OCR_MAX_PIXELS || 2200000),
    retries: Number(process.env.OCR_RETRIES || 2),
    pageMarkers: true,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input' || a === '-i') args.input = argv[++i];
    else if (a === '--out' || a === '-o') args.out = argv[++i];
    else if (a === '--base-url') args.baseUrl = argv[++i];
    else if (a === '--prompt') args.prompt = argv[++i];
    else if (a === '--model') args.model = argv[++i];
    else if (a === '--dpi') args.dpi = Number(argv[++i]);
    else if (a === '--max-pixels') args.maxPixels = Number(argv[++i]);
    else if (a === '--retries') args.retries = Number(argv[++i]);
    else if (a === '--no-page-markers') args.pageMarkers = false;
    else if (a === '--page-markers') args.pageMarkers = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown arg: ${a}`);
  }

  return args;
}

function usage() {
  return `Usage:
  node scripts/ocr.js --input <file> [--out output.txt] [--base-url http://127.0.0.1:8080] [--prompt "..."] [--model <name>] [--dpi 220] [--max-pixels 2200000] [--retries 2] [--no-page-markers]

Notes:
  - Input can be an image (png/jpg/webp/gif) or PDF.
  - PDFs are processed one page at a time.
  - Each PDF page first attempts embedded text extraction; OCR is used only when no text is found.
  - PDF page render DPI is automatically capped per-page to avoid oversized vision inputs.
  - Multi-page PDFs are delimited with a page break (form-feed); page headers are included by default.
  - Requires a running llama-server with GLM-OCR model loaded.
`;
}

async function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${cmd} ${args.join(' ')} failed with code ${code}\n${stderr || stdout}`));
    });
  });
}

async function getPdfPageCount(pdfPath) {
  try {
    const { stdout } = await run('pdfinfo', [pdfPath]);
    const m = stdout.match(/^Pages:\s+(\d+)/m);
    if (m) return Number(m[1]);
  } catch {}

  const { stdout } = await run('qpdf', ['--show-npages', pdfPath]);
  const n = Number(stdout.trim());
  if (!Number.isFinite(n) || n <= 0) throw new Error('Unable to determine PDF page count');
  return n;
}

async function getPdfPageSizePoints(pdfPath, page) {
  const { stdout } = await run('pdfinfo', ['-f', String(page), '-l', String(page), pdfPath]);
  const m = stdout.match(/Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)\s+pts/i);
  if (!m) throw new Error(`Unable to determine PDF page size for page ${page}`);
  return { widthPt: Number(m[1]), heightPt: Number(m[2]) };
}

function normalizeExtractedPdfText(text) {
  return text.replace(/\f/g, '').replace(/\r\n/g, '\n').trim();
}

async function extractPdfPageText(pdfPath, page) {
  const { stdout } = await run('pdftotext', [
    '-f',
    String(page),
    '-l',
    String(page),
    '-layout',
    '-enc',
    'UTF-8',
    '-nopgbrk',
    pdfPath,
    '-',
  ]);

  return normalizeExtractedPdfText(stdout);
}

function effectiveDpiForPage({ requestedDpi, widthPt, heightPt, maxPixels }) {
  if (!Number.isFinite(maxPixels) || maxPixels <= 0) return requestedDpi;

  const pointsArea = widthPt * heightPt;
  if (!Number.isFinite(pointsArea) || pointsArea <= 0) return requestedDpi;

  // pixels = (widthPt * dpi / 72) * (heightPt * dpi / 72)
  const maxDpi = Math.floor(Math.sqrt((maxPixels * 72 * 72) / pointsArea));
  if (!Number.isFinite(maxDpi) || maxDpi <= 0) return requestedDpi;

  return Math.max(72, Math.min(requestedDpi, maxDpi));
}

function mimeFromExt(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  return 'application/octet-stream';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableOcrError(err) {
  const msg = String(err?.message || err);
  return (
    /fetch failed/i.test(msg) ||
    /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up/i.test(msg) ||
    /OCR request failed.*\b5\d\d\b/i.test(msg)
  );
}

async function ocrImage({ imagePath, pageLabel, args }) {
  const mime = mimeFromExt(imagePath);
  const buf = await fsp.readFile(imagePath);
  const b64 = buf.toString('base64');

  const body = {
    model: args.model,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: args.prompt },
          { type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
        ],
      },
    ],
  };

  if (!body.model) delete body.model;

  const attempts = Math.max(1, args.retries + 1);
  let lastErr;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const resp = await fetch(`${args.baseUrl.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`OCR request failed for ${pageLabel}: ${resp.status} ${resp.statusText}\n${text}`);
      }

      const json = await resp.json();
      const text = json?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`No OCR text returned for ${pageLabel}`);
      return text.trim();
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableOcrError(err);
      if (!retryable || attempt === attempts) break;
      process.stderr.write(`Transient OCR failure on ${pageLabel} (attempt ${attempt}/${attempts}); retrying...\n`);
      await sleep(300 * attempt);
    }
  }

  throw lastErr;
}

async function convertPdfPageToPng({ pdfPath, page, dir, dpi }) {
  const prefixBase = `page-${String(page).padStart(4, '0')}`;
  const prefix = path.join(dir, prefixBase);

  await run('pdftoppm', ['-f', String(page), '-l', String(page), '-r', String(dpi), '-png', pdfPath, prefix]);

  const files = await fsp.readdir(dir);
  const candidates = files
    .filter((name) => name.startsWith(`${prefixBase}-`) && name.endsWith('.png'))
    .sort();

  if (candidates.length === 0) {
    throw new Error(`pdftoppm did not produce PNG for page ${page}`);
  }

  return path.join(dir, candidates[candidates.length - 1]);
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help || !args.input) {
    console.log(usage());
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(args.input);
  if (!fs.existsSync(inputPath)) throw new Error(`Input file not found: ${inputPath}`);

  const ext = path.extname(inputPath).toLowerCase();
  const isPdf = ext === '.pdf';
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'glm-ocr-'));

  try {
    const results = [];
    let joinSeparator = '\n\n';

    if (isPdf) {
      const pages = await getPdfPageCount(inputPath);
      if (pages > 1) joinSeparator = '\n\n\f\n\n';

      for (let page = 1; page <= pages; page++) {
        process.stderr.write(`Checking embedded text on page ${page}/${pages}...\n`);
        const extractedText = await extractPdfPageText(inputPath, page);

        let text = extractedText;
        if (!text) {
          const { widthPt, heightPt } = await getPdfPageSizePoints(inputPath, page);
          const pageDpi = effectiveDpiForPage({
            requestedDpi: args.dpi,
            widthPt,
            heightPt,
            maxPixels: args.maxPixels,
          });

          process.stderr.write(`No embedded text found on page ${page}; OCR (dpi=${pageDpi})...\n`);
          const png = await convertPdfPageToPng({ pdfPath: inputPath, page, dir: tmpDir, dpi: pageDpi });
          text = await ocrImage({ imagePath: png, pageLabel: `page ${page}`, args });
        } else {
          process.stderr.write(`Using embedded text for page ${page}.\n`);
        }

        if (args.pageMarkers) results.push(`--- PAGE ${page} ---\n${text}`);
        else results.push(text);
      }
    } else {
      process.stderr.write('OCR image...\n');
      const text = await ocrImage({ imagePath: inputPath, pageLabel: 'image', args });
      results.push(text);
    }

    const merged = results.join(joinSeparator);
    if (args.out) {
      const outPath = path.resolve(args.out);
      await fsp.writeFile(outPath, merged, 'utf8');
      console.log(`Wrote OCR output to ${outPath}`);
    } else {
      process.stdout.write(`${merged}\n`);
    }
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
