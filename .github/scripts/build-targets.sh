#!/usr/bin/env bash
# Builds every target in $TARGETS (discover-plugins' `targets` output) one at a
# time with build-target.sh, which also checks each build put the expected
# plugin into dist/. Sequential: targets of one package share dist/, so they
# cannot build concurrently.
#
# Env: TARGETS (JSON array of {dir, pkg, id, script}), GITHUB_WORKSPACE (repo
# root; `dir` is relative to it). Run from plugins/, where pnpm resolves the
# workspace.
set -euo pipefail

build_target="$(dirname "$0")/build-target.sh"
count="$(jq 'length' <<<"$TARGETS")"
if [ "$count" -eq 0 ]; then
	echo "::error::no build targets were discovered, so nothing would be built"
	exit 1
fi

for ((i = 0; i < count; i++)); do
	pkg="$(jq -r ".[$i].pkg" <<<"$TARGETS")"
	id="$(jq -r ".[$i].id" <<<"$TARGETS")"
	dir="$(jq -r ".[$i].dir" <<<"$TARGETS")"
	script="$(jq -r ".[$i].script" <<<"$TARGETS")"

	echo "::group::$pkg → $id"
	if PKG="$pkg" ID="$id" DIR="$dir" SCRIPT="$script" bash "$build_target"; then
		echo "::endgroup::"
	else
		echo "::endgroup::"
		exit 1
	fi
done
