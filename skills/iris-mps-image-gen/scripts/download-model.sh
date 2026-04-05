#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <model-key> [extra args]" >&2
  echo "Examples: 4b | 4b-base | 9b | 9b-base | zimage-turbo" >&2
  exit 1
fi

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
SRC_DIR="$ARTIFACTS_DIR/iris-src"
MODELS_DIR="$ARTIFACTS_DIR/models"

if [[ ! -x "$SRC_DIR/download_model.sh" ]]; then
  echo "iris source not found at: $SRC_DIR" >&2
  echo "Run scripts/setup.sh first." >&2
  exit 1
fi

mkdir -p "$MODELS_DIR"

(
  cd "$MODELS_DIR"
  "$SRC_DIR/download_model.sh" "$@"
)

echo "Models directory: $MODELS_DIR"
