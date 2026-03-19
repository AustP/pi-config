#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_URL="${LLAMA_SERVER_URL:-http://127.0.0.1:8080}"

for ((i=1; i<=$#; i++)); do
  arg="${!i}"
  if [[ "$arg" == "--base-url" ]]; then
    j=$((i + 1))
    if (( j <= $# )); then
      BASE_URL="${!j}"
    fi
  fi
done

URL_NO_PROTO="${BASE_URL#*://}"
HOST_PORT="${URL_NO_PROTO%%/*}"
HOST="${HOST_PORT%%:*}"
PORT="${HOST_PORT##*:}"
if [[ "$HOST" == "$PORT" ]]; then
  PORT="8080"
fi

MODELS_URL="${BASE_URL%/}/v1/models"
LOG_FILE="${TMPDIR:-/tmp}/llama-ocr-$$.log"

"$SCRIPT_DIR/start-llama-server.sh" --host "$HOST" --port "$PORT" >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

for _ in {1..180}; do
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "llama-server exited before becoming ready." >&2
    echo "--- llama-server log tail ($LOG_FILE) ---" >&2
    tail -n 120 "$LOG_FILE" >&2 || true
    exit 1
  fi

  OUT="$(curl -sS "$MODELS_URL" 2>/dev/null || true)"
  if echo "$OUT" | grep -q '"data"'; then
    LLAMA_SERVER_URL="$BASE_URL" node "$SCRIPT_DIR/ocr.js" "$@"
    exit $?
  fi
  sleep 1
done

echo "Timed out waiting for llama-server at $BASE_URL" >&2
echo "--- llama-server log tail ($LOG_FILE) ---" >&2
tail -n 120 "$LOG_FILE" >&2 || true
exit 1
