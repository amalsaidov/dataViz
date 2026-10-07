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
# shellcheck source=SCRIPTDIR/annotations.sh
source "$scripts/annotations.sh"
title="$(escape_property "Grafana API compatibility ($ID)")"

mkdir -p "$out_dir"
verdict="$(bash "$scripts/levitate-verdict.sh" "$report")"
case "$verdict" in
compatible)
	touch "$out_dir/clean"
	exit 0
	;;
incompatible)
	echo "::warning title=$title::$(escape_message "$MODULE may be incompatible with the latest @grafana/* packages; see the levitate output in the Compatibility check step")"
	;;
unknown)
	echo "::warning title=$title::$(escape_message "levitate did not finish checking $MODULE, so compatibility is unknown; see the Compatibility check step")"
	;;
esac
VERDICT="$verdict" bash "$scripts/levitate-comment.sh" "$report" "$out_dir/comment.md"
