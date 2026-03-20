#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

RUNNING=1
trap 'RUNNING=0' INT TERM

echo "[dev:stable] Starting PulseBoard dev server with auto-restart..."

while [ "$RUNNING" -eq 1 ]; do
  npm run dev -- --force
  EXIT_CODE=$?
  if [ "$RUNNING" -ne 1 ]; then
    break
  fi
  echo "[dev:stable] Dev server exited with code $EXIT_CODE. Restarting in 2s..."
  sleep 2
done

echo "[dev:stable] Stopped."
