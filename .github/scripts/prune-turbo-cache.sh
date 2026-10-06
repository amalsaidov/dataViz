#!/usr/bin/env bash
# Deletes turbo cache entries that the runs summarized in <runs-dir> did not
# use, so the cache CI saves holds one run's results instead of growing with
# every commit until it crowds out other caches.
#
# A turbo cache entry is <hash>.tar.zst plus <hash>-meta.json and
# <hash>-manifest.json; `turbo run --summarize` writes the hashes each run
# used to <runs-dir>/*.json.
#
# Usage: prune-turbo-cache.sh <cache-dir> <runs-dir>
set -euo pipefail
shopt -s nullglob # must precede the globs, or `set -u` sees the literal pattern

cache_dir="${1:?usage: prune-turbo-cache.sh <cache-dir> <runs-dir>}"
runs_dir="${2:?usage: prune-turbo-cache.sh <cache-dir> <runs-dir>}"

summaries=("$runs_dir"/*.json)
if [ "${#summaries[@]}" -eq 0 ]; then
	echo "::warning::no turbo run summaries in $runs_dir, so the cache was not pruned"
	exit 0
fi

used="$(jq -r '.tasks[].hash' "${summaries[@]}" | sort -u)"
kept=0
removed=0
for entry in "$cache_dir"/*; do
	name="$(basename "$entry")"
	hash="${name%%[-.]*}" # <hash>.tar.zst, <hash>-meta.json, <hash>-manifest.json
	if grep -qx "$hash" <<<"$used"; then
		kept=$((kept + 1))
	else
		rm -f "$entry"
		removed=$((removed + 1))
	fi
done
echo "turbo cache: kept $kept files, removed $removed"
