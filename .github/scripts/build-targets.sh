#!/usr/bin/env bash
# Builds every target in $TARGETS (discover-plugins' `targets` output) one at a
# time and checks each build put the expected plugin into dist/. Sequential:
# targets of one package share dist/, so they cannot build concurrently.
#
# Env: TARGETS (JSON array of {dir, pkg, id, script}), GITHUB_WORKSPACE (repo
# root; `dir` is relative to it). Run from plugins/, where pnpm resolves the
# workspace.
set -euo pipefail

count="$(jq 'length' <<<"$TARGETS")"
if [ "$count" -eq 0 ]; then
	echo "::error::no build targets were discovered, so nothing would be built"
	exit 1
fi

for ((i = 0; i < count; i++)); do
	dir="$(jq -r ".[$i].dir" <<<"$TARGETS")"
	pkg="$(jq -r ".[$i].pkg" <<<"$TARGETS")"
	id="$(jq -r ".[$i].id" <<<"$TARGETS")"
	script="$(jq -r ".[$i].script" <<<"$TARGETS")"
	dist_json="$GITHUB_WORKSPACE/$dir/dist/plugin.json"

	echo "::group::$pkg → $id"
	# `^...` builds the package's workspace dependencies but not the package
	# itself; exits 0 when it has none.
	pnpm turbo run build --filter "$pkg^..."
	pnpm --filter "$pkg" run "$script"
	echo "::endgroup::"

	if [ ! -f "$dist_json" ]; then
		echo "::error file=$dir/package.json::$pkg script '$script' wrote no dist/plugin.json, expected '$id'"
		exit 1
	fi
	built="$(jq -r '.id // ""' "$dist_json")"
	if [ "$built" != "$id" ]; then
		echo "::error file=$dir/dist/plugin.json::$pkg script '$script' built '$built', expected '$id'"
		exit 1
	fi
done
