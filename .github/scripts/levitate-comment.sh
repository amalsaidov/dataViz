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
max_headers=20

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

# The first max_headers "Comparing …" header lines, and the first max_items
# numbered findings ("1) Changed `config` used in …").
numbered_finding='^[0-9]+\) '
items=''
item_count=0
header_count=0
add_item() {
	if [ -z "$items" ]; then
		items="$1"
	else
		items="$items
$1"
	fi
}
while IFS= read -r line; do
	if [[ "$line" == 'Comparing '* ]]; then
		header_count=$((header_count + 1))
		if [ "$header_count" -le "$max_headers" ]; then
			add_item "$line"
		fi
	elif [[ "$line" =~ $numbered_finding ]]; then
		item_count=$((item_count + 1))
		if [ "$item_count" -le "$max_items" ]; then
			add_item "$line"
		fi
	fi
done <"$report"

if [ -z "$items" ]; then
	items='(no itemized incompatibilities; see the full report)'
elif [ "$item_count" -gt "$max_items" ]; then
	items="$items
… $((item_count - max_items)) more in the full report"
fi

# Tilde fences, not backticks: levitate wraps each type diff in its own
# \`\`\`diff block, and a backtick line would close a backtick fence early.
summary="### Grafana API compatibility: \`$ID\`

$intro [Full run]($RUN_URL)

~~~text
$items
~~~
"

# The folded report gets what the summary leaves (${#summary} is the
# summary's length), minus room for the details wrapper.
report_budget=$((max_comment_bytes - ${#summary} - 200))
# Never negative: GNU `head -c -N` prints all but the last N bytes.
if [ "$report_budget" -lt 0 ]; then
	report_budget=0
fi
{
	printf '%s\n' "$summary"
	echo '<details><summary>Full levitate report</summary>'
	echo
	echo '~~~text'
	# iconv -c drops a multibyte character that head -c cut in half, but then
	# exits 1, which pipefail would turn into a failed job; the output is fine.
	head -c "$report_budget" "$report" | { iconv -f UTF-8 -t UTF-8 -c || true; }
	# The trailing echo ends a report truncated mid-line, so the fence closes.
	echo
	echo '~~~'
	echo
	echo '</details>'
} >"$out"
