#!/usr/bin/env bash
# Prints what levitate's report says about a module: `compatible`,
# `incompatible`, or `unknown` when levitate did not finish (no report, a
# crash, an npm outage). The is-compatible action runs levitate with
# `|| true` and only looks for "not fully compatible", so on its own it
# cannot tell "compatible" from "never ran".
#
# Usage: levitate-verdict.sh <levitate-output>
set -euo pipefail

report="${1:?usage: levitate-verdict.sh <levitate-output>}"

if [ ! -f "$report" ]; then
	echo unknown
elif grep -q 'is not fully compatible' "$report"; then
	echo incompatible
elif grep -q 'appears to be compatible' "$report"; then
	echo compatible
else
	echo unknown
fi
