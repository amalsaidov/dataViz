#!/usr/bin/env bash
# Prints every plugin build target under <root> as a compact JSON array:
#   [{dir, pkg, id, script, plugin_json}]
#
# A package declares its targets in build-targets.json. Without one it has a
# single implicit target: its src/plugin.json id, built by its `build` script.
# Every error is reported (as a GitHub annotation) before exiting 1, so one run
# shows them all.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root>}"
targets='[]'
failed=0

error() {
	echo "::error file=$1::$2" >&2
	failed=1
}

for pkg_json in "$root"/*/package.json; do
	dir="$(dirname "$pkg_json")"
	pkg="$(jq -r '.name' "$pkg_json")"
	manifest="$dir/build-targets.json"

	if [ -f "$manifest" ]; then
		declared="$(jq -c '.targets' "$manifest")"
		if ! jq -e 'type == "array" and length > 0' <<<"$declared" >/dev/null; then
			error "$manifest" "targets must be a non-empty array"
			continue
		fi
		source_file="$manifest"
	else
		root_id="$(jq -r '.id // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$root_id" ]; then
			error "$pkg_json" "no build-targets.json and no id in src/plugin.json, so this package has no build target"
			continue
		fi
		declared="$(jq -nc --arg id "$root_id" '[{id: $id, script: "build", pluginJson: "src/plugin.json"}]')"
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
		if ! jq -e --arg s "$script" '.scripts | has($s)' "$pkg_json" >/dev/null; then
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
done

[ "$failed" -eq 0 ] || exit 1
echo "$targets"
