#!/usr/bin/env bash
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACTS_DIR="$SKILL_DIR/artifacts"
SRC_DIR="$ARTIFACTS_DIR/iris-src"
BIN_DIR="$ARTIFACTS_DIR/bin"
BIN_PATH="$BIN_DIR/iris"
REPO_URL="https://github.com/antirez/iris.c"

mkdir -p "$ARTIFACTS_DIR" "$BIN_DIR" "$ARTIFACTS_DIR/models" "$ARTIFACTS_DIR/outputs"

if [[ ! -d "$SRC_DIR/.git" ]]; then
  git clone "$REPO_URL" "$SRC_DIR"
else
  git -C "$SRC_DIR" fetch --all --prune
  git -C "$SRC_DIR" pull --ff-only
fi

make -C "$SRC_DIR" mps
cp "$SRC_DIR/iris" "$BIN_PATH"
chmod +x "$BIN_PATH"

echo "Built MPS iris binary: $BIN_PATH"
