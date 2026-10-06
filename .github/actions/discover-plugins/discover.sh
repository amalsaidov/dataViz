#!/usr/bin/env bash
# Prints the CI view of every plugin package under <root> as one compact JSON
# object:
#   {"targets": [{dir, pkg, id, script, plugin_json}],
#    "e2e":     [{dir, pkg, url, grafana_dependency}]}
#
# targets: what each package publishes. A package declares them in
# plugin-ci.json `targets`; without that it has one implicit target, its
# src/plugin.json id built by its `build` script.
#
# e2e: one entry per package (not per target) with both an `e2e` script and a
# playwright.config.ts. Its suite tests whatever the package's own
# docker-compose.yaml mounts, i.e. the `build` output. `url` is plugin-ci.json
# `e2e.url`, default http://127.0.0.1:3000.
#
# With <base-sha>, both lists keep only packages with a file changed since
# that commit, unless a shared file changed, in which case nothing is filtered.
# Shared means any path under plugins/ but outside <root> (lockfile, .shared/,
# turbo.json, ...), or one of ALWAYS_ALL below.
#
# Every error is reported (as a GitHub annotation) before exiting 1.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root> [<base-sha>]}"
base="${2:-}"
default_e2e_url='http://127.0.0.1:3000'

# Outside plugins/, a change to any of these can affect every package. Inside
# plugins/ the rule is inverted (see the filter below): everything not under
# <root> counts, so a new build-affecting file needs no entry here.
ALWAYS_ALL=(
	.github/actions/discover-plugins/
	.github/actions/setup-workspace/
	.github/scripts/
	.github/workflows/plugin-ci.yml
	.github/workflows/plugin-e2e.yml
	.github/workflows/plugin-bundle-stats.yml
)

targets='[]'
e2e='[]'
failed=0

error() {
	echo "::error file=$1::$2" >&2
	failed=1
}

for pkg_json in "$root"/*/package.json; do
	dir="$(dirname "$pkg_json")"
	pkg="$(jq -r '.name' "$pkg_json")"
	manifest="$dir/plugin-ci.json"
	config='{}'
	if [ -f "$manifest" ]; then
		if ! config="$(jq -c '.' "$manifest" 2>/dev/null)"; then
			error "$manifest" "is not valid JSON"
			continue
		fi
		if [ "$(jq -r 'type' <<<"$config")" != object ]; then
			error "$manifest" "must be a JSON object, like {\"targets\": [...]}"
			continue
		fi
	fi

	if jq -e 'has("targets")' <<<"$config" >/dev/null; then
		declared="$(jq -c '.targets' <<<"$config")"
		if ! jq -e 'type == "array" and length > 0' <<<"$declared" >/dev/null; then
			error "$manifest" "targets must be a non-empty array"
			declared='[]'
		fi
		source_file="$manifest"
	else
		root_id="$(jq -r '.id // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$root_id" ]; then
			error "$pkg_json" "no plugin-ci.json targets and no id in src/plugin.json, so this package has no build target"
			declared='[]'
		else
			declared="$(jq -nc --arg id "$root_id" '[{id: $id, script: "build", pluginJson: "src/plugin.json"}]')"
		fi
		source_file="$pkg_json"
	fi

	# Indexed rather than read from @tsv: bash's `read` collapses consecutive
	# tabs, which would shift fields when one is empty.
	count="$(jq 'length' <<<"$declared")"
	for ((i = 0; i < count; i++)); do
		id="$(jq -r ".[$i].id // \"\"" <<<"$declared")"
		script="$(jq -r ".[$i].script // \"\"" <<<"$declared")"
		plugin_json="$(jq -r ".[$i].pluginJson // \"\"" <<<"$declared")"

		if [[ ! "$id" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
			error "$source_file" "target id '$id' must match ^[a-z0-9][a-z0-9-]*\$"
			continue
		fi
		# turbo and `pnpm --filter` both exit 0 on a missing script, so a typo
		# here would otherwise build nothing and pass.
		if ! jq -e --arg s "$script" '(.scripts // {}) | has($s)' "$pkg_json" >/dev/null; then
			error "$source_file" "target $id: script '$script' is not in $pkg_json"
			continue
		fi
		if [ ! -f "$dir/$plugin_json" ]; then
			error "$source_file" "target $id: pluginJson '$plugin_json' does not exist"
			continue
		fi
		actual_id="$(jq -r '.id // ""' "$dir/$plugin_json")"
		if [ "$actual_id" != "$id" ]; then
			error "$source_file" "target $id: $plugin_json has id '$actual_id'"
			continue
		fi
		if jq -e --arg id "$id" 'any(.[]; .id == $id)' <<<"$targets" >/dev/null; then
			error "$source_file" "target id $id is declared more than once"
			continue
		fi

		targets="$(jq -c --arg dir "$dir" --arg pkg "$pkg" --arg id "$id" --arg script "$script" --arg pj "$plugin_json" \
			'. + [{dir: $dir, pkg: $pkg, id: $id, script: $script, plugin_json: $pj}]' <<<"$targets")"
	done

	has_script="$(jq -r '(.scripts // {}) | has("e2e")' "$pkg_json")"
	has_config=false
	if [ -f "$dir/playwright.config.ts" ]; then
		has_config=true
	fi
	if [ "$has_script" = true ] && [ "$has_config" = true ]; then
		url="$(jq -r --arg d "$default_e2e_url" '.e2e.url // $d' <<<"$config")"
		range="$(jq -r '.dependencies.grafanaDependency // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$range" ]; then
			error "$dir/src/plugin.json" "has an e2e suite but no dependencies.grafanaDependency to pick Grafana versions from"
		else
			e2e="$(jq -c --arg dir "$dir" --arg pkg "$pkg" --arg url "$url" --arg range "$range" \
				'. + [{dir: $dir, pkg: $pkg, url: $url, grafana_dependency: $range}]' <<<"$e2e")"
		fi
	elif [ "$has_script" = true ]; then
		error "$pkg_json" "has an e2e script but no playwright.config.ts"
	elif [ "$has_config" = true ]; then
		error "$dir/playwright.config.ts" "exists but $pkg_json has no e2e script"
	fi
done

[ "$failed" -eq 0 ] || exit 1

# True if a changed path can affect every package, not only the one it is in.
affects_every_package() {
	local path="$1" shared
	case "$path" in
	"$packages_prefix"*) return 1 ;; # inside a single plugin package
	plugins/*) return 0 ;;           # anything else under plugins/
	esac
	for shared in "${ALWAYS_ALL[@]}"; do
		# Entries ending in / match everything below them.
		if [ "$path" = "$shared" ] || [[ "$shared" == */ && "$path" == "$shared"* ]]; then
			return 0
		fi
	done
	return 1
}

if [ -n "$base" ]; then
	packages_prefix="${root%/}/"
	# --no-renames: a file moved between packages must list its old path too,
	# or the package it left would look unchanged.
	if changed="$(git diff --no-renames --name-only "$base" HEAD 2>/dev/null)"; then
		filter=true
		changed_dirs='[]'
		while IFS= read -r path; do
			if [ -z "$path" ]; then
				continue
			fi
			if affects_every_package "$path"; then
				filter=false
				break
			fi
			if [[ "$path" == "$packages_prefix"* ]]; then
				# plugins/packages/@plugins/<name>/... -> plugins/packages/@plugins/<name>
				rest="${path#"$packages_prefix"}"
				changed_dirs="$(jq -c --arg d "$packages_prefix${rest%%/*}" '. + [$d]' <<<"$changed_dirs")"
			fi
		done <<<"$changed"

		if [ "$filter" = true ]; then
			keep='map(select(.dir | IN($dirs[])))'
			targets="$(jq -c --argjson dirs "$changed_dirs" "$keep" <<<"$targets")"
			e2e="$(jq -c --argjson dirs "$changed_dirs" "$keep" <<<"$e2e")"
		fi
	else
		echo "::warning::cannot diff against $base, so every package is selected" >&2
	fi
fi

jq -nc --argjson t "$targets" --argjson e "$e2e" '{targets: $t, e2e: $e}'
