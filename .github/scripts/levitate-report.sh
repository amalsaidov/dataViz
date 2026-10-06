#!/usr/bin/env bash
# Turns levitate's report for one build target into what compatibility-report
# posts: <out-dir>/clean when levitate found the module compatible, otherwise
# <out-dir>/comment.md plus a warning annotation. Never fails the job;
# compatibility is non-blocking.
#
# Usage: levitate-report.sh <levitate-output> <out-dir>
# Env: ID (plugin id), MODULE (levitate --path), RUN_URL.
set -euo pipefail

report="${1:?usage: levitate-report.sh <levitate-output> <out-dir>}"
out_dir="${2:?usage: levitate-report.sh <levitate-output> <out-dir>}"
scripts="$(dirname "$0")"

mkdir -p "$out_dir"
verdict="$(bash "$scripts/levitate-verdict.sh" "$report")"
case "$verdict" in
compatible)
	touch "$out_dir/clean"
	exit 0
	;;
incompatible)
	echo "::warning title=Grafana API compatibility ($ID)::$MODULE may be incompatible with the latest @grafana/* packages; see the levitate output in the Compatibility check step"
	;;
unknown)
	echo "::warning title=Grafana API compatibility ($ID)::levitate did not finish checking $MODULE, so compatibility is unknown; see the Compatibility check step"
	;;
esac
VERDICT="$verdict" bash "$scripts/levitate-comment.sh" "$report" "$out_dir/comment.md"
