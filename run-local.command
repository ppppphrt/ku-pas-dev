#!/bin/sh
set -eu
cd "$(dirname "$0")"
BUNDLED_PYTHON="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [ -x "$BUNDLED_PYTHON" ]; then
  exec "$BUNDLED_PYTHON" run_local.py "$@"
fi
exec python3 run_local.py "$@"
