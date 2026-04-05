#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
BIN_PATH="$ARTIFACTS_DIR/bin/iris"
MODELS_DIR="$ARTIFACTS_DIR/models"
OUTPUTS_DIR="$ARTIFACTS_DIR/outputs"

PROMPT=""
MODEL_DIR="flux-klein-4b"
OUTPUT=""
EXTRA_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --prompt)
      PROMPT="$2"
      shift 2
      ;;
    --model-dir)
      MODEL_DIR="$2"
      shift 2
      ;;
    --output)
      OUTPUT="$2"
      shift 2
      ;;
    *)
      EXTRA_ARGS+=("$1")
      shift
      ;;
  esac
done

if [[ -z "$PROMPT" ]]; then
  echo "Usage: $0 --prompt \"text\" [--model-dir flux-klein-4b] [--output name.png] [extra iris args]" >&2
  exit 1
fi

if [[ ! -x "$BIN_PATH" ]]; then
  echo "Missing iris binary: $BIN_PATH" >&2
  echo "Run scripts/setup.sh first." >&2
  exit 1
fi

MODEL_PATH="$MODELS_DIR/$MODEL_DIR"
if [[ ! -d "$MODEL_PATH" ]]; then
  echo "Model directory not found: $MODEL_PATH" >&2
  echo "Run scripts/download-model.sh <model-key> first." >&2
  exit 1
fi

mkdir -p "$OUTPUTS_DIR"

if [[ -z "$OUTPUT" ]]; then
  OUTPUT="$OUTPUTS_DIR/iris-$(date +%Y%m%d-%H%M%S).png"
elif [[ "$OUTPUT" != /* ]]; then
  OUTPUT="$OUTPUTS_DIR/$OUTPUT"
fi

"$BIN_PATH" -d "$MODEL_PATH" -p "$PROMPT" -o "$OUTPUT" "${EXTRA_ARGS[@]}"

echo "OUTPUT: $OUTPUT"
echo "DISCORD_ATTACH: $OUTPUT"
