#!/usr/bin/env bash
# Escaping for GitHub annotation lines (::error / ::warning), sourced by the
# scripts that print them.
#
# Annotation text often includes values from a PR's own files (plugin-ci.json,
# package.json, a built dist/plugin.json). GitHub reads `%`, CR and LF in it as
# escapes and line breaks, so an unescaped newline could start a second
# workflow command. Property values (file=, title=) also escape `:` and `,`.

# Escapes text for the message part, after the final `::`.
escape_message() {
	local text="$1"
	text="${text//\%/%25}"
	text="${text//$'\r'/%0D}"
	text="${text//$'\n'/%0A}"
	printf '%s' "$text"
}

# Escapes text for a property value such as file= or title=.
escape_property() {
	local text
	text="$(escape_message "$1")"
	text="${text//:/%3A}"
	text="${text//,/%2C}"
	printf '%s' "$text"
}
