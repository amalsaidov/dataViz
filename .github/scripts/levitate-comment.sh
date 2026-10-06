#!/usr/bin/env bash
# Writes the PR comment body for one target's levitate report. It leads with
# the "Comparing …" and numbered incompatibility lines, and folds the full
# report into a collapsed code block, truncated well under GitHub's
# 65536-character comment limit.
#
# Usage: levitate-comment.sh <levitate-output> <comment-file>
# Env: ID (plugin id), MODULE (levitate --path), RUN_URL.
set -euo pipefail

report="${1:?usage: levitate-comment.sh <levitate-output> <comment-file>}"
out="${2:?usage: levitate-comment.sh <levitate-output> <comment-file>}"
max_report_bytes=60000

{
	echo "### Grafana API compatibility: \`$ID\`"
	echo
	echo "levitate reports \`$MODULE\` may be incompatible with the latest \`@grafana/*\` packages."
	echo "This is non-blocking: levitate flags any type change in a used export, so check the e2e jobs"
	echo "for whether it actually breaks. [Full run]($RUN_URL)"
	echo
	echo '```text'
	grep -E '^Comparing |^[0-9]+\) ' "$report" || echo '(no itemized incompatibilities; see the full report)'
	echo '```'
	echo
	echo '<details><summary>Full levitate report</summary>'
	echo
	echo '```text'
	# The trailing echo ends a report truncated mid-line, so the fence closes.
	head -c "$max_report_bytes" "$report"
	echo
	echo '```'
	echo
	echo '</details>'
} >"$out"
