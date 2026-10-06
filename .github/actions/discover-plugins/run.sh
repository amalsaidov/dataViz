#!/usr/bin/env bash
# The action's entry point: picks the base commit for `changed-only`, runs
# discover.sh, and writes its two lists to $GITHUB_OUTPUT as `targets` and
# `e2e`.
#
# Env: ROOT, CHANGED_ONLY ('true' to filter), PR_BASE
# (github.event.pull_request.base.sha), PUSH_BEFORE (github.event.before),
# ACTION_PATH (directory holding discover.sh), GITHUB_OUTPUT.
set -euo pipefail

base=''
if [ "$CHANGED_ONLY" = true ]; then
	base="${PR_BASE:-$PUSH_BEFORE}"
	# A push that creates a branch has an all-zero `before`.
	if [[ "$base" =~ ^0+$ ]]; then
		base=''
	fi
fi

args=("$ROOT")
[ -z "$base" ] || args+=("$base")
result="$(bash "$ACTION_PATH/discover.sh" "${args[@]}")"
jq . <<<"$result"
{
	echo "targets=$(jq -c '.targets' <<<"$result")"
	echo "e2e=$(jq -c '.e2e' <<<"$result")"
} >>"$GITHUB_OUTPUT"
