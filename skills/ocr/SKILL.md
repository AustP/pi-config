---
name: ocr
description: Run local OCR with llama-server + GLM-OCR for images and PDFs. Use when a user wants text extracted from scanned documents, screenshots, or multi-page PDFs.
---

# OCR skill (GLM-OCR + llama-server)

Use this single command path:

```bash
scripts/ocr-once.sh --input /path/to/file.pdf --out /path/to/output.txt
```

It always:
1. starts `llama-server`
2. runs OCR
3. shuts down `llama-server`

## Options

- `--input` / `-i` (required): image or PDF
- `--out` / `-o`: output text file (prints to stdout if omitted)
- `--base-url`: llama-server URL (default `http://127.0.0.1:8080`)
- `--prompt`: OCR prompt override
- `--model`: model name override (optional)
- `--dpi`: target PDF render DPI (default 220)
- `--max-pixels`: per-page image pixel cap before OCR (default `2200000`)
- `--retries`: retries for transient OCR/server errors (default `2`)
- `--no-page-markers`: omit `--- PAGE N ---` headers in merged PDF output (default keeps markers)

## Multi-page PDFs

The command handles PDFs one page at a time:

1. Detects page count
2. Tries extracting embedded text per page (`pdftotext`)
3. If no embedded text is found, computes a safe per-page DPI (caps only when a page would exceed the vision pixel budget)
4. Converts that page to PNG
5. Sends OCR pages sequentially to `/v1/chat/completions`
6. Retries transient OCR/server failures automatically
7. Merges text into a single output with explicit page delimiters (`\f` form-feed)
8. Includes `--- PAGE N ---` headers by default (disable with `--no-page-markers`)

## Dependencies

- Node.js 18+
- `llama-server` in `PATH`
- `pdftoppm` + `pdfinfo` (from poppler)
- `qpdf` (fallback page counter)

macOS install:

```bash
brew install poppler qpdf
```
