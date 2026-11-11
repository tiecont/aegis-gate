#!/bin/sh
set -eu
expected=26.13.0
candidate=${AEGIS_NODE_BIN:-node}
if command -v "$candidate" >/dev/null 2>&1 && [ "$("$candidate" -p process.versions.node)" = "$expected" ]; then
  command -v "$candidate"
elif [ -x .local/toolchains/node/bin/node ] && [ "$(.local/toolchains/node/bin/node -p process.versions.node)" = "$expected" ]; then
  printf '%s/.local/toolchains/node/bin/node\n' "$PWD"
else
  printf 'Node%s required. Run make bootstrap or set AEGIS_NODE_BIN to pinned binary.\n' "$expected" >&2
  exit 1
fi
