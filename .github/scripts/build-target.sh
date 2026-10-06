#!/usr/bin/env bash
# Builds one plugin package's script: its workspace dependencies first, then
# the script itself, with any extra arguments passed through to it (e.g.
# webpack's --profile --json). With ID set, also checks that dist/plugin.json
# is that plugin, so a build that quietly produced a different one fails.
#
# Env: PKG (package name), SCRIPT (package.json script), DIR (repo-root-relative
# package dir), ID (expected plugin id; optional), GITHUB_WORKSPACE (repo root).
# Run from plugins/, where pnpm resolves the workspace.
set -euo pipefail

# `^...` builds the package's workspace dependencies but not the package
# itself; exits 0 when it has none.
pnpm turbo run build --filter "$PKG^..."
pnpm --filter "$PKG" run "$SCRIPT" "$@"

if [ -z "${ID:-}" ]; then
	exit 0
fi

dist_json="$GITHUB_WORKSPACE/$DIR/dist/plugin.json"
if [ ! -f "$dist_json" ]; then
	echo "::error file=$DIR/package.json::$PKG script '$SCRIPT' wrote no dist/plugin.json, expected '$ID'"
	exit 1
fi
built="$(jq -r '.id // ""' "$dist_json")"
if [ "$built" != "$ID" ]; then
	echo "::error file=$DIR/dist/plugin.json::$PKG script '$SCRIPT' built '$built', expected '$ID'"
	exit 1
fi
