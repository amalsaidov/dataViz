#!/usr/bin/env bash
# Writes the PR comment body for one target's levitate report. It leads with
# the "Comparing …" and numbered incompatibility lines, and folds the full
# report into a collapsed code block. The whole comment stays under GitHub's
# 65536-character limit: the itemized list is cut at max_items lines, and the
# folded report gets whatever room is left.
#
# Usage: levitate-comment.sh <levitate-output> <comment-file>
# Env: ID (plugin id), MODULE (levitate --path), RUN_URL, VERDICT
# (`incompatible`, or `unknown` when levitate did not finish; see
# levitate-verdict.sh).
set -euo pipefail

report="${1:?usage: levitate-comment.sh <levitate-output> <comment-file>}"
out="${2:?usage: levitate-comment.sh <levitate-output> <comment-file>}"
max_comment_bytes=60000
max_items=50

if [ ! -f "$report" ]; then
	report=/dev/null
fi

if [ "${VERDICT:-incompatible}" = unknown ]; then
	intro="levitate did not finish checking \`$MODULE\`, so its compatibility with the latest \`@grafana/*\` packages is unknown. Re-run the job; if it keeps happening, the full report below says why."
else
	intro="levitate reports \`$MODULE\` may be incompatible with the latest \`@grafana/*\` packages.
This is non-blocking: levitate flags any type change in a used export, so check the e2e jobs
for whether it actually breaks."
fi

# Every "Comparing …" header, and the first max_items numbered findings.
items="$(awk -v max="$max_items" '/^Comparing /{ print; next } /^[0-9]+\) /{ found++; if (found <= max) print }' "$report")"
item_count="$(grep -cE '^[0-9]+\) ' "$report" || true)"
if [ -z "$items" ]; then
	items='(no itemized incompatibilities; see the full report)'
elif [ "$item_count" -gt "$max_items" ]; then
	items="$items
… $((item_count - max_items)) more in the full report"
fi

summary="### Grafana API compatibility: \`$ID\`

$intro [Full run]($RUN_URL)

\`\`\`text
$items
\`\`\`
"

# Whatever the summary leaves, minus room for the details wrapper. iconv -c
# drops a multibyte character that head -c cut in half.
report_budget=$((max_comment_bytes - ${#summary} - 200))
{
	printf '%s\n' "$summary"
	echo '<details><summary>Full levitate report</summary>'
	echo
	echo '```text'
	# The trailing echo ends a report truncated mid-line, so the fence closes.
	head -c "$report_budget" "$report" | iconv -f UTF-8 -t UTF-8 -c
	echo
	echo '```'
	echo
	echo '</details>'
} >"$out"
