#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "==> Server tests"
if ! npm --prefix "$ROOT_DIR/server" run test; then
  echo "Server tests flaked, retrying once..."
  npm --prefix "$ROOT_DIR/server" run test
fi

echo "==> Server build"
npm --prefix "$ROOT_DIR/server" run build

echo "==> Socket regression"
if ! npm --prefix "$ROOT_DIR/server" run sim:socket; then
  echo "Socket regression flaked, retrying once..."
  npm --prefix "$ROOT_DIR/server" run sim:socket
fi

echo "==> Client lint"
npm --prefix "$ROOT_DIR/client" run lint

echo ""
echo "All checks passed."
