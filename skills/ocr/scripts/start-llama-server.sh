#!/usr/bin/env bash
set -euo pipefail

CTX="${LLAMA_CTX:-12000}"
PARALLEL="${LLAMA_PARALLEL:-1}"
BATCH="${LLAMA_BATCH:-1024}"
UBATCH="${LLAMA_UBATCH:-256}"

exec llama-server \
  -hf ggml-org/GLM-OCR-GGUF:GLM-OCR-Q8_0.gguf \
  -c "$CTX" \
  -np "$PARALLEL" \
  -b "$BATCH" \
  -ub "$UBATCH" \
  --no-cont-batching \
  --cache-ram 0 \
  --flash-attn off \
  "$@"
