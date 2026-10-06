#!/usr/bin/env bash
# Finds the module.ts(x) that sits next to a build target's plugin.json and
# writes its repo-root-relative path (as levitate wants it) to $GITHUB_OUTPUT
# as `path`.
#
# Env: DIR (repo-root-relative package dir), PLUGIN_JSON (package-relative),
# GITHUB_OUTPUT. Run from the repo root.
set -euo pipefail

src="$DIR/$(dirname "$PLUGIN_JSON")"
for f in "$src/module.ts" "$src/module.tsx"; do
	if [ -f "$f" ]; then
		echo "path=./$f" >>"$GITHUB_OUTPUT"
		exit 0
	fi
done
echo "::error file=$DIR/$PLUGIN_JSON::no module.ts or module.tsx next to it"
exit 1
