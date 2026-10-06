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
# that commit, unless a shared file changed (see SHARED_*), in which case
# nothing is filtered.
#
# Every error is reported (as a GitHub annotation) before exiting 1.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root> [<base-sha>]}"
base="${2:-}"
default_e2e_url='http://127.0.0.1:3000'

# A change to any of these can affect every package.
SHARED_FILES=(
	plugins/package.json
	plugins/pnpm-lock.yaml
	plugins/pnpm-workspace.yaml
	.github/workflows/plugin-ci.yml
	.github/workflows/plugin-e2e.yml
	.github/workflows/plugin-bundle-stats.yml
)
SHARED_PREFIXES=(
	plugins/packages/@shared/
	.github/actions/discover-plugins/
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
	[ ! -f "$manifest" ] || config="$(jq -c '.' "$manifest")"

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
	[ ! -f "$dir/playwright.config.ts" ] || has_config=true
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

if [ -n "$base" ]; then
	if changed="$(git diff --name-only "$base" HEAD 2>/dev/null)"; then
		changed_json="$(jq -Rsc 'split("\n") | map(select(length > 0))' <<<"$changed")"
		shared_files="$(printf '%s\n' "${SHARED_FILES[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
		shared_prefixes="$(printf '%s\n' "${SHARED_PREFIXES[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
		if ! jq -e --argjson f "$shared_files" --argjson p "$shared_prefixes" \
			'any(.[]; . as $c | ($f | index($c)) != null or any($p[]; . as $pre | $c | startswith($pre)))' \
			<<<"$changed_json" >/dev/null; then
			keep='map(select(.dir as $d | any($changed[]; startswith($d + "/"))))'
			targets="$(jq -c --argjson changed "$changed_json" "$keep" <<<"$targets")"
			e2e="$(jq -c --argjson changed "$changed_json" "$keep" <<<"$e2e")"
		fi
	else
		echo "::warning::cannot diff against $base, so every package is selected" >&2
	fi
fi

jq -nc --argjson t "$targets" --argjson e "$e2e" '{targets: $t, e2e: $e}'
