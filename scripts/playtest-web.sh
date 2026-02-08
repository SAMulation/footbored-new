#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_PORT="${SERVER_PORT:-3000}"
CLIENT_PORT="${CLIENT_PORT:-8081}"
SERVER_URL="http://localhost:${SERVER_PORT}"

cleanup() {
  if [[ -n "${SERVER_PID:-}" ]]; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
  if [[ -n "${CLIENT_PID:-}" ]]; then
    kill "$CLIENT_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> Starting server on :${SERVER_PORT}"
npm --prefix "$ROOT_DIR/server" run dev &
SERVER_PID=$!

echo "==> Starting Expo web client on :${CLIENT_PORT}"
(
  cd "$ROOT_DIR/client"
  EXPO_PUBLIC_SERVER_URL="$SERVER_URL" npx expo start --web --port "$CLIENT_PORT"
) &
CLIENT_PID=$!

echo ""
echo "Playtest is running:"
echo "  Client: http://localhost:${CLIENT_PORT}"
echo "  Server: ${SERVER_URL}"
echo "Press Ctrl+C to stop both."
echo ""

wait "$CLIENT_PID"
