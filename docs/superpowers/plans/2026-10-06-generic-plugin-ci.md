# Generic Plugin CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run levitate compatibility, Playwright e2e and bundle-size reporting for every plugin package from generic workflows, replacing the echarts-only `echarts-ci.yml` and `echarts-bundle-stats.yml`.

**Architecture:** The per-package manifest `build-targets.json` is renamed `plugin-ci.json` and gains an optional `e2e.url`. The discovery action is renamed `discover-plugins`. It emits `targets` (per plugin build target) and `e2e` (per package with an e2e suite), and can filter both to packages changed against a base commit. `plugin-ci.yml` fans compatibility out over targets and e2e over packages, via the reusable `plugin-e2e.yml`. `plugin-bundle-stats.yml` fans out over targets.

**Tech Stack:** GitHub Actions (composite action, reusable workflow, matrices), bash, jq, git, pnpm, turbo, grafana/plugin-actions (`is-compatible`, `e2e-version`, `wait-for-grafana`, bundle-size report script).

**Spec:** `docs/superpowers/specs/2026-10-06-generic-plugin-ci-design.md` (follows `2026-10-06-build-targets-design.md`).

## Global Constraints

- Every `uses:` of a third-party action is pinned to a commit SHA with a `# <tag>` comment. Reuse exactly these pins, all already in the repo:
  - `actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6`
  - `pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6`
  - `actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6`
  - `actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7`
  - `actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8`
  - `actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0`
  - `grafana/plugin-actions/is-compatible@4698961fa64137fcac207108397ebe8a738a33d1 # is-compatible/v1.0.3`
  - `grafana/plugin-actions/e2e-version@3ef49643a84470fd25bafeb96701fa0be3be6746 # e2e-version/v3.0.2`
  - `grafana/plugin-actions/wait-for-grafana@4205a0824a13b71fdb9b9b49f28f5f72b754f81f # wait-for-grafana/v1.0.5`
  - bundle-size report script checkout: `repository: grafana/plugin-actions`, `ref: a66a1c96cdbb176f9cccf10cf23593e250db7cce # bundle-size/v1.1.0`
- Local composite actions are referenced as `$/.github/actions/<name>`, the form already used and working in `i18n-verify.yml` and `ci.yml`. The local reusable workflow is referenced as `$/.github/workflows/plugin-e2e.yml` (zizmor `self-repository`).
- No `${{ }}` inside `run:` scripts. Pass values through `env:`. `${{ }}` in `with:`, `name:`, `if:`, `working-directory:`, `strategy:` is fine.
- `zizmor .github/workflows/` must report nothing new.
- Every job declares minimal `permissions:`. Workflows set `permissions: {}` at the top level.
- Commit messages are conventional (`feat(CI): …`, `refactor(CI): …`, `docs: …`), with no `Co-Authored-By` or "Generated with" lines.
- Stage by explicit path only. Never `git add -A`, `git add .` or `git commit -a`. The working tree has unrelated uncommitted changes that must never be staged: `.claude/commands/import-external-plugin.md`, plus untracked `.github/workflows/{bundle-stats,cp-update,is-compatible,release}.yml`.
- Manifest: `plugin-ci.json` at a package root. Keys: `targets` (array of `{id, script, pluginJson}`) and `e2e.url` (string). Both are optional, and so is the file.
- Default e2e URL: `http://127.0.0.1:3000`.
- Discovery outputs:
  - `targets`: `[{dir, pkg, id, script, plugin_json}]`
  - `e2e`: `[{dir, pkg, url, grafana_dependency}]`
  - `dir` is repo-root-relative (`plugins/packages/@plugins/<name>`).
- "Filter nothing" paths for `changed-only`: `plugins/package.json`, `plugins/pnpm-lock.yaml`, `plugins/pnpm-workspace.yaml`, `plugins/packages/@shared/` (prefix), `.github/actions/discover-plugins/` (prefix), `.github/workflows/plugin-ci.yml`, `.github/workflows/plugin-e2e.yml`, `.github/workflows/plugin-bundle-stats.yml`.
- Bundle-stats main artifact name: `<id>-main-branch-stats`. Threshold `'5'`.

---

### Task 5: Rename to `plugin-ci.json` / `discover-plugins`, add `e2e` output and `changed-only`

**Files:**
- Rename: `plugins/packages/@plugins/grafana-echarts/build-targets.json` → `plugins/packages/@plugins/grafana-echarts/plugin-ci.json` (and add `e2e`)
- Rename: `.github/actions/discover-build-targets/` → `.github/actions/discover-plugins/` (`action.yaml`, `discover.sh`), then rewrite both
- Modify: `.github/workflows/ci.yml`, the `uses:` line of the "Discover build targets" step
- Modify: `CLAUDE.md`, the `## Build targets (\`build-targets.json\`)` section and the echarts "Root CI builds `grafana-relations-panel`" bullet (file name and action name only)

**Interfaces:**
- Produces: `bash .github/actions/discover-plugins/discover.sh <root> [<base-sha>]` prints one compact JSON object `{"targets":[…],"e2e":[…]}` on stdout and exits 0, or prints `::error file=…::` lines on stderr and exits 1. With `<base-sha>`, both lists are filtered to changed packages; a `::warning::` is printed and nothing is filtered if `git diff` against the base fails.
- Produces: action `$/.github/actions/discover-plugins` with input `changed-only` (`'true'`/`'false'`, default `'false'`) and outputs `targets` and `e2e` (compact JSON arrays).

- [ ] **Step 1: Rename with git**

```bash
git mv .github/actions/discover-build-targets .github/actions/discover-plugins
git mv plugins/packages/@plugins/grafana-echarts/build-targets.json plugins/packages/@plugins/grafana-echarts/plugin-ci.json
```

- [ ] **Step 2: Write `plugin-ci.json`**

`plugins/packages/@plugins/grafana-echarts/plugin-ci.json`:

```json
{
  "targets": [
    {
      "id": "grafana-relations-panel",
      "script": "build:relations",
      "pluginJson": "src/modules/relations/plugin.json"
    }
  ],
  "e2e": {
    "url": "http://127.0.0.1:3020"
  }
}
```

Then run `cd plugins && pnpm --filter @plugins/grafana-echarts exec prettier --write plugin-ci.json`.

- [ ] **Step 3: Rewrite `discover.sh`**

Replace `.github/actions/discover-plugins/discover.sh` entirely with:

```bash
#!/usr/bin/env bash
# Prints the CI view of every plugin package under <root> as one compact JSON
# object:
#   {"targets": [{dir, pkg, id, script, plugin_json}],
#    "e2e":     [{dir, pkg, url, grafana_dependency}]}
#
# targets: what each package publishes. A package declares them in
# plugin-ci.json `targets`; without that it has one implicit target, its
# src/plugin.json id built by its `build` script.
#
# e2e: one entry per package (not per target) with both an `e2e` script and a
# playwright.config.ts. Its suite tests whatever the package's own
# docker-compose.yaml mounts, i.e. the `build` output. `url` is plugin-ci.json
# `e2e.url`, default http://127.0.0.1:3000.
#
# With <base-sha>, both lists keep only packages with a file changed since
# that commit, unless a shared file changed (see SHARED_*), in which case
# nothing is filtered.
#
# Every error is reported (as a GitHub annotation) before exiting 1.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root> [<base-sha>]}"
base="${2:-}"
default_e2e_url='http://127.0.0.1:3000'

# A change to any of these can affect every package.
SHARED_FILES=(
	plugins/package.json
	plugins/pnpm-lock.yaml
	plugins/pnpm-workspace.yaml
	.github/workflows/plugin-ci.yml
	.github/workflows/plugin-e2e.yml
	.github/workflows/plugin-bundle-stats.yml
)
SHARED_PREFIXES=(
	plugins/packages/@shared/
	.github/actions/discover-plugins/
)

targets='[]'
e2e='[]'
failed=0

error() {
	echo "::error file=$1::$2" >&2
	failed=1
}

for pkg_json in "$root"/*/package.json; do
	dir="$(dirname "$pkg_json")"
	pkg="$(jq -r '.name' "$pkg_json")"
	manifest="$dir/plugin-ci.json"
	config='{}'
	[ ! -f "$manifest" ] || config="$(jq -c '.' "$manifest")"

	if jq -e 'has("targets")' <<<"$config" >/dev/null; then
		declared="$(jq -c '.targets' <<<"$config")"
		if ! jq -e 'type == "array" and length > 0' <<<"$declared" >/dev/null; then
			error "$manifest" "targets must be a non-empty array"
			declared='[]'
		fi
		source_file="$manifest"
	else
		root_id="$(jq -r '.id // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$root_id" ]; then
			error "$pkg_json" "no plugin-ci.json targets and no id in src/plugin.json, so this package has no build target"
			declared='[]'
		else
			declared="$(jq -nc --arg id "$root_id" '[{id: $id, script: "build", pluginJson: "src/plugin.json"}]')"
		fi
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
		if ! jq -e --arg s "$script" '(.scripts // {}) | has($s)' "$pkg_json" >/dev/null; then
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

	has_script="$(jq -r '(.scripts // {}) | has("e2e")' "$pkg_json")"
	has_config=false
	[ ! -f "$dir/playwright.config.ts" ] || has_config=true
	if [ "$has_script" = true ] && [ "$has_config" = true ]; then
		url="$(jq -r --arg d "$default_e2e_url" '.e2e.url // $d' <<<"$config")"
		range="$(jq -r '.dependencies.grafanaDependency // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$range" ]; then
			error "$dir/src/plugin.json" "has an e2e suite but no dependencies.grafanaDependency to pick Grafana versions from"
		else
			e2e="$(jq -c --arg dir "$dir" --arg pkg "$pkg" --arg url "$url" --arg range "$range" \
				'. + [{dir: $dir, pkg: $pkg, url: $url, grafana_dependency: $range}]' <<<"$e2e")"
		fi
	elif [ "$has_script" = true ]; then
		error "$pkg_json" "has an e2e script but no playwright.config.ts"
	elif [ "$has_config" = true ]; then
		error "$dir/playwright.config.ts" "exists but $pkg_json has no e2e script"
	fi
done

[ "$failed" -eq 0 ] || exit 1

if [ -n "$base" ]; then
	if changed="$(git diff --name-only "$base" HEAD 2>/dev/null)"; then
		changed_json="$(jq -Rsc 'split("\n") | map(select(length > 0))' <<<"$changed")"
		shared_files="$(printf '%s\n' "${SHARED_FILES[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
		shared_prefixes="$(printf '%s\n' "${SHARED_PREFIXES[@]}" | jq -Rsc 'split("\n") | map(select(length > 0))')"
		if ! jq -e --argjson f "$shared_files" --argjson p "$shared_prefixes" \
			'any(.[]; . as $c | ($f | index($c)) != null or any($p[]; . as $pre | $c | startswith($pre)))' \
			<<<"$changed_json" >/dev/null; then
			keep='map(select(.dir as $d | any($changed[]; startswith($d + "/"))))'
			targets="$(jq -c --argjson changed "$changed_json" "$keep" <<<"$targets")"
			e2e="$(jq -c --argjson changed "$changed_json" "$keep" <<<"$e2e")"
		fi
	else
		echo "::warning::cannot diff against $base, so every package is selected" >&2
	fi
fi

jq -nc --argjson t "$targets" --argjson e "$e2e" '{targets: $t, e2e: $e}'
```

- [ ] **Step 4: Rewrite `action.yaml`**

Replace `.github/actions/discover-plugins/action.yaml` entirely with:

```yaml
name: Discover plugins
description: Emit JSON matrices of every plugin build target and every package e2e suite, optionally limited to changed packages.

inputs:
  root:
    description: 'Directory holding the plugin packages to scan.'
    required: false
    default: plugins/packages/@plugins
  changed-only:
    description: |
      'true' to keep only packages changed since the PR base (pull_request)
      or the previous commit (push). Needs the base commit in the checkout
      (fetch-depth: 0). Without a usable base, nothing is filtered.
    required: false
    default: 'false'

outputs:
  targets:
    description: |
      One entry per build target. Fields: dir (repo-root-relative package
      directory), pkg (package name), id (plugin id), script (package.json
      script that builds it into dist/), plugin_json (package-relative source
      plugin.json).
    value: ${{ steps.find.outputs.targets }}
  e2e:
    description: |
      One entry per package with an e2e suite. Fields: dir, pkg, url (where
      its docker-compose.yaml serves Grafana), grafana_dependency (from
      src/plugin.json).
    value: ${{ steps.find.outputs.e2e }}

runs:
  using: 'composite'
  steps:
    - id: find
      shell: bash
      env:
        ROOT: ${{ inputs.root }}
        CHANGED_ONLY: ${{ inputs.changed-only }}
        PR_BASE: ${{ github.event.pull_request.base.sha }}
        PUSH_BEFORE: ${{ github.event.before }}
        ACTION_PATH: ${{ github.action_path }}
      run: |
        set -euo pipefail
        base=''
        if [ "$CHANGED_ONLY" = true ]; then
          base="${PR_BASE:-$PUSH_BEFORE}"
          # A push that creates a branch has an all-zero `before`.
          [[ "$base" =~ ^0+$ ]] && base=''
        fi
        result="$(bash "$ACTION_PATH/discover.sh" "$ROOT" $base)"
        jq . <<<"$result"
        {
          echo "targets=$(jq -c '.targets' <<<"$result")"
          echo "e2e=$(jq -c '.e2e' <<<"$result")"
        } >> "$GITHUB_OUTPUT"
```

(`$base` is unquoted on purpose: an empty value passes no second argument.)

- [ ] **Step 5: Point root `ci.yml` at the renamed action**

In `.github/workflows/ci.yml`, change `uses: $/.github/actions/discover-build-targets` to `uses: $/.github/actions/discover-plugins`. Also change the comment above it from `build-targets.json` to `plugin-ci.json`. The Build step reads `steps.targets.outputs.targets`, which is unchanged.

- [ ] **Step 6: Update CLAUDE.md names**

In `CLAUDE.md`:
- Retitle `## Build targets (\`build-targets.json\`)` to `## Per-package CI config (\`plugin-ci.json\`)`.
- Replace every `build-targets.json` with `plugin-ci.json`, and every `discover-build-targets` with `discover-plugins`.
- In that section, after the "Targets build one at a time" bullet, add:

```markdown
- `e2e.url` (default `http://127.0.0.1:3000`) is where the package's own `docker-compose.yaml` serves
  Grafana. A package gets e2e CI when it has both an `e2e` script and a `playwright.config.ts`. Having only
  one of them is a discovery error.
```

- [ ] **Step 7: Verify against the real tree**

From the repo root:
```bash
bash .github/actions/discover-plugins/discover.sh plugins/packages/@plugins | jq .
```
Expected, exit 0:
- `targets`: the same 3 as before (clock `build`, echarts `grafana-relations-panel` / `build:relations`, workspace `build`)
- `e2e`: exactly 2 entries:
  - clock-panel, `url` `http://127.0.0.1:3000`, a non-empty `grafana_dependency`
  - echarts, `url` `http://127.0.0.1:3020`, a non-empty `grafana_dependency`

workspace-panel must be absent from `e2e`.

`grep -rn "build-targets\|discover-build-targets" .github CLAUDE.md plugins/packages --include='*' -l | grep -v node_modules` should print nothing.

- [ ] **Step 8: Verify `changed-only` filtering locally**

Use temporary commits on a throwaway branch, then delete it:

```bash
# Do NOT stash: the unrelated working-tree changes ride along untouched.
start="$(git rev-parse HEAD)"
git switch -c tmp/discover-filter-test

# clock-only change
echo "// tmp" >> plugins/packages/@plugins/grafana-clock-panel/src/module.ts
git add plugins/packages/@plugins/grafana-clock-panel/src/module.ts && git commit -qm tmp
bash .github/actions/discover-plugins/discover.sh plugins/packages/@plugins "$start" | jq -c '{t: [.targets[].id], e: [.e2e[].pkg]}'
# expected: {"t":["grafana-clock-panel"],"e":["@plugins/grafana-clock-panel"]}

# shared change selects everything
echo "" >> plugins/pnpm-workspace.yaml
git add plugins/pnpm-workspace.yaml && git commit -qm tmp
bash .github/actions/discover-plugins/discover.sh plugins/packages/@plugins "$start" | jq -c '{t: [.targets[].id], e: [.e2e[].pkg]}'
# expected: all 3 target ids, both e2e packages

# unusable base: warning, everything selected
bash .github/actions/discover-plugins/discover.sh plugins/packages/@plugins 0123456789abcdef0123456789abcdef01234567 | jq -c '[.targets[].id] | length'
# expected: stderr "::warning::cannot diff against …", stdout 3

git switch -q -           # back to chore/ci-cd-testing
git branch -D tmp/discover-filter-test
git status --short        # expected: only the pre-existing unrelated changes
```

- [ ] **Step 9: Verify the new error paths with throwaway fixtures (not committed)**

```bash
F="$(mktemp -d)"
mk() { mkdir -p "$F/$1/src"; echo "{\"name\":\"@t/$1\",\"scripts\":{\"build\":\"x\"$3}}" > "$F/$1/package.json"; echo "{\"id\":\"$2\",\"dependencies\":{\"grafanaDependency\":\">=12.0.0\"}}" > "$F/$1/src/plugin.json"; }
mk scriptonly so-panel ',"e2e":"x"'
mk configonly co-panel ''; touch "$F/configonly/playwright.config.ts"
mk both b-panel ',"e2e":"x"'; touch "$F/both/playwright.config.ts"; echo '{"e2e":{"url":"http://127.0.0.1:4000"}}' > "$F/both/plugin-ci.json"
bash .github/actions/discover-plugins/discover.sh "$F"; echo "exit $?"
rm -f "$F/scriptonly/package.json" "$F/configonly/playwright.config.ts"
mk scriptonly so-panel ''
bash .github/actions/discover-plugins/discover.sh "$F" | jq -c '.e2e'
rm -rf "$F"
```
Expected:
- First run: `exit 1` with two errors, `has an e2e script but no playwright.config.ts` and `exists but … has no e2e script`.
- Second run: `[{"dir":"…/both","pkg":"@t/both","url":"http://127.0.0.1:4000","grafana_dependency":">=12.0.0"}]`. This shows a `plugin-ci.json` with only `e2e` (no `targets`) keeps the implicit target.

- [ ] **Step 10: Commit**

```bash
# the git mv in Step 1 already staged the renames; don't name the old paths (git add errors on them)
git add .github/actions/discover-plugins plugins/packages/@plugins/grafana-echarts/plugin-ci.json .github/workflows/ci.yml CLAUDE.md
git commit -m "refactor(CI): rename build-targets.json to plugin-ci.json and add e2e discovery"
```

---

### Task 6: `plugin-ci.yml` + reusable `plugin-e2e.yml`, retire `echarts-ci.yml`

**Files:**
- Create: `.github/workflows/plugin-e2e.yml`
- Create: `.github/workflows/plugin-ci.yml`
- Delete: `.github/workflows/echarts-ci.yml`

**Interfaces:**
- Consumes: `$/.github/actions/discover-plugins` with `changed-only: 'true'` → outputs `targets` `[{dir,pkg,id,script,plugin_json}]` and `e2e` `[{dir,pkg,url,grafana_dependency}]` (Task 5).
- Produces: reusable workflow `$/.github/workflows/plugin-e2e.yml` with string inputs `dir`, `pkg`, `url`, `grafana-dependency`.

- [ ] **Step 1: Write `plugin-e2e.yml`**

```yaml
# Playwright e2e for one plugin package, against every Grafana version its
# grafanaDependency allows (plus a non-blocking nightly). Called once per
# package by plugin-ci.yml; reusable rather than inline because the version
# list is per-package matrix output, which can't feed a second matrix within
# one workflow.
#
# The package's own docker-compose.yaml serves Grafana (not the monorepo dev
# stack in plugins/): it mounts only this package's dist/, built by its
# `build` script.
name: Plugin e2e

on:
  workflow_call:
    inputs:
      dir:
        description: Repo-root-relative package directory.
        required: true
        type: string
      pkg:
        description: Package name.
        required: true
        type: string
      url:
        description: Where the package's docker-compose.yaml serves Grafana.
        required: true
        type: string
      grafana-dependency:
        description: semver range from the package's src/plugin.json.
        required: true
        type: string

permissions: {}

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    permissions:
      contents: read
    defaults:
      run:
        working-directory: plugins
    outputs:
      artifact: ${{ steps.metadata.outputs.artifact }}
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      # package_json_file is relative to the workspace root — action inputs are
      # not affected by defaults.run.working-directory.
      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6
        with:
          package_json_file: plugins/package.json
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version-file: plugins/.nvmrc
          cache: 'pnpm'
          cache-dependency-path: plugins/pnpm-lock.yaml

      - name: Install dependencies
        run: pnpm install --frozen-lockfile --prefer-offline

      - name: Build
        env:
          PKG: ${{ inputs.pkg }}
        run: |
          pnpm turbo run build --filter "$PKG^..."
          pnpm --filter "$PKG" run build

      - name: Get plugin metadata
        id: metadata
        env:
          DIR: ${{ inputs.dir }}
        run: |
          id="$(jq -r '.id' "$GITHUB_WORKSPACE/$DIR/dist/plugin.json")"
          version="$(jq -r '.info.version' "$GITHUB_WORKSPACE/$DIR/dist/plugin.json")"
          echo "artifact=e2e-${id}-${version}" >> "$GITHUB_OUTPUT"

      - name: Upload test build
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: ${{ steps.metadata.outputs.artifact }}
          path: ${{ inputs.dir }}/dist
          retention-days: 5

  resolve-versions:
    name: Resolve e2e images
    runs-on: ubuntu-latest
    timeout-minutes: 3
    permissions:
      contents: read
    outputs:
      matrix: ${{ steps.resolve-versions.outputs.matrix }}
    steps:
      # e2e-version has no plugin-directory input; left alone it reads
      # src/plugin.json at the repo root, which doesn't exist here.
      - name: Resolve Grafana E2E versions
        id: resolve-versions
        uses: grafana/plugin-actions/e2e-version@3ef49643a84470fd25bafeb96701fa0be3be6746 # e2e-version/v3.0.2
        with:
          grafana-dependency: ${{ inputs.grafana-dependency }}

  playwright-tests:
    needs: [resolve-versions, build]
    timeout-minutes: 15
    # e2e-version adds a grafana-enterprise@nightly entry to the matrix. The
    # nightly run is informational: a failure there shows on the job, but does
    # not fail the workflow. Do not make its check required in branch protection,
    # because that overrides this setting.
    continue-on-error: ${{ matrix.GRAFANA_IMAGE.VERSION == 'nightly' }}
    strategy:
      fail-fast: false
      matrix:
        GRAFANA_IMAGE: ${{ fromJson(needs.resolve-versions.outputs.matrix) }}
    name: ${{ matrix.GRAFANA_IMAGE.name }}@${{ matrix.GRAFANA_IMAGE.VERSION }}${{ matrix.GRAFANA_IMAGE.VERSION == 'nightly' && ' (non-blocking)' || '' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
    defaults:
      run:
        working-directory: ${{ inputs.dir }}
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      - name: Download plugin
        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8
        with:
          path: ${{ inputs.dir }}/dist
          name: ${{ needs.build.outputs.artifact }}

      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6
        with:
          package_json_file: plugins/package.json
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version-file: plugins/.nvmrc
          cache: 'pnpm'
          cache-dependency-path: plugins/pnpm-lock.yaml

      - name: Install dev dependencies
        working-directory: plugins
        run: pnpm install --frozen-lockfile --prefer-offline

      - name: Start Grafana
        env:
          GRAFANA_VERSION: ${{ matrix.GRAFANA_IMAGE.VERSION }}
          GRAFANA_IMAGE: ${{ matrix.GRAFANA_IMAGE.NAME }}
        run: |
          docker compose pull
          ANONYMOUS_AUTH_ENABLED=false DEVELOPMENT=false docker compose up -d

      - name: Wait for grafana server
        uses: grafana/plugin-actions/wait-for-grafana@4205a0824a13b71fdb9b9b49f28f5f72b754f81f # wait-for-grafana/v1.0.5
        with:
          url: ${{ inputs.url }}/login

      - name: Install Playwright Browsers
        run: pnpm exec playwright install chromium --with-deps

      - name: Run Playwright tests
        id: run-tests
        env:
          GRAFANA_URL: ${{ inputs.url }}
        run: pnpm run e2e

      - name: Docker logs
        if: ${{ always() && steps.run-tests.outcome == 'failure' }}
        run: docker compose logs > grafana-server.log 2>&1

      - name: Stop grafana docker
        if: ${{ always() }}
        run: docker compose down
```

- [ ] **Step 2: Write `plugin-ci.yml`**

```yaml
# Per-plugin CI beyond root ci.yml's format/lint/type-check/test/build:
# levitate API compatibility for every build target, and Playwright e2e for
# every package with an e2e suite. Both lists come from discover-plugins
# (see plugin-ci.json in CLAUDE.md), limited to packages this change touches.
name: Plugin CI

on:
  pull_request:
    paths:
      - 'plugins/**'
      - '.github/actions/discover-plugins/**'
      - '.github/workflows/plugin-ci.yml'
      - '.github/workflows/plugin-e2e.yml'
  push:
    branches:
      - main
    paths:
      - 'plugins/**'
      - '.github/actions/discover-plugins/**'
      - '.github/workflows/plugin-ci.yml'
      - '.github/workflows/plugin-e2e.yml'

permissions: {}

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  discover:
    name: Discover plugins
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      targets: ${{ steps.find.outputs.targets }}
      e2e: ${{ steps.find.outputs.e2e }}
    steps:
      # Full history: changed-only diffs against the PR base / previous commit.
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false
          fetch-depth: 0

      - id: find
        uses: $/.github/actions/discover-plugins
        with:
          changed-only: 'true'

  compatibility:
    name: compatibility (${{ matrix.target.id }})
    needs: discover
    if: github.event_name == 'pull_request' && needs.discover.outputs.targets != '[]'
    runs-on: ubuntu-latest
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        target: ${{ fromJSON(needs.discover.outputs.targets) }}
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6
        with:
          package_json_file: plugins/package.json
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version-file: plugins/.nvmrc
          cache: 'pnpm'
          cache-dependency-path: plugins/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: plugins
        run: pnpm install --frozen-lockfile --prefer-offline

      - name: Build
        working-directory: plugins
        env:
          PKG: ${{ matrix.target.pkg }}
          SCRIPT: ${{ matrix.target.script }}
        run: |
          pnpm turbo run build --filter "$PKG^..."
          pnpm --filter "$PKG" run "$SCRIPT"

      # module.ts(x) sits next to the target's plugin.json.
      - name: Find module
        id: module
        env:
          DIR: ${{ matrix.target.dir }}
          PLUGIN_JSON: ${{ matrix.target.plugin_json }}
        run: |
          src="$DIR/$(dirname "$PLUGIN_JSON")"
          for f in "$src/module.ts" "$src/module.tsx"; do
            if [ -f "$f" ]; then
              echo "path=./$f" >> "$GITHUB_OUTPUT"
              exit 0
            fi
          done
          echo "::error file=$DIR/$PLUGIN_JSON::no module.ts or module.tsx next to it"
          exit 1

      # Module paths are repo-root-relative, which is where the action runs levitate.
      - name: Compatibility check
        uses: grafana/plugin-actions/is-compatible@4698961fa64137fcac207108397ebe8a738a33d1 # is-compatible/v1.0.3
        with:
          module: ${{ steps.module.outputs.path }}
          comment-pr: 'no'
          fail-if-incompatible: 'yes'

  e2e:
    name: e2e (${{ matrix.package.pkg }})
    needs: discover
    if: needs.discover.outputs.e2e != '[]'
    permissions:
      contents: read
    strategy:
      fail-fast: false
      matrix:
        package: ${{ fromJSON(needs.discover.outputs.e2e) }}
    uses: $/.github/workflows/plugin-e2e.yml
    with:
      dir: ${{ matrix.package.dir }}
      pkg: ${{ matrix.package.pkg }}
      url: ${{ matrix.package.url }}
      grafana-dependency: ${{ matrix.package.grafana_dependency }}
```

- [ ] **Step 3: Delete `echarts-ci.yml`**

```bash
git rm .github/workflows/echarts-ci.yml
```

- [ ] **Step 4: Lint**

```bash
zizmor .github/workflows/plugin-ci.yml .github/workflows/plugin-e2e.yml
```
Expected: no findings. If zizmor isn't installed, report that instead of installing it. If `actionlint` is installed, also run `actionlint .github/workflows/plugin-ci.yml .github/workflows/plugin-e2e.yml` and fix any real errors. Report `$/` local-action-ref complaints but don't act on them: that form is established in the repo.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/plugin-ci.yml .github/workflows/plugin-e2e.yml  # the git rm is already staged
git commit -m "feat(CI): generic per-plugin compatibility and e2e workflows"
```

---

### Task 7: `plugin-bundle-stats.yml`, retire `echarts-bundle-stats.yml`

**Files:**
- Create: `.github/workflows/plugin-bundle-stats.yml`
- Delete: `.github/workflows/echarts-bundle-stats.yml`

**Interfaces:**
- Consumes: `$/.github/actions/discover-plugins` with `changed-only: 'true'` → output `targets` `[{dir,pkg,id,script,plugin_json}]` (Task 5).

- [ ] **Step 1: Write `plugin-bundle-stats.yml`**

```yaml
# Bundle-size report per plugin build target: on main, builds each target's
# webpack stats and stores them as an artifact; on a PR, builds the PR's stats
# and comments the delta against main's.
#
# grafana/plugin-actions/bundle-size can't be used as-is here: its install step
# runs `pnpm install` at the repo root, ignoring its working-directory input,
# and the repo root has no package.json (the pnpm workspace is plugins/). So
# this reproduces the action's steps with pnpm scoped to the workspace, and
# calls the action's own report script, checked out at the same pinned commit.
name: Plugin bundle stats

on:
  workflow_dispatch:
  pull_request:
    paths:
      - 'plugins/**'
      - '.github/actions/discover-plugins/**'
      - '.github/workflows/plugin-bundle-stats.yml'
  push:
    branches:
      - main
    paths:
      - 'plugins/**'
      - '.github/actions/discover-plugins/**'
      - '.github/workflows/plugin-bundle-stats.yml'

permissions: {}

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  THRESHOLD: '5'

jobs:
  discover:
    name: Discover plugins
    runs-on: ubuntu-latest
    permissions:
      contents: read
    outputs:
      targets: ${{ steps.find.outputs.targets }}
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false
          fetch-depth: 0

      - id: find
        uses: $/.github/actions/discover-plugins
        with:
          changed-only: 'true'

  compare:
    name: bundle size (${{ matrix.target.id }})
    needs: discover
    if: needs.discover.outputs.targets != '[]'
    runs-on: ubuntu-latest
    # pull-requests: write is only needed by the final report step. This is a
    # `pull_request` trigger, so on fork PRs the token is read-only regardless
    # and that step fails rather than posting -- deliberate, versus taking a
    # write token onto `pull_request_target`.
    permissions:
      contents: read # checkout, plus grafana/plugin-actions for the report script
      pull-requests: write # comment the size delta on the PR
      actions: read # look up the latest main-branch stats.json artifact
    strategy:
      fail-fast: false
      matrix:
        target: ${{ fromJSON(needs.discover.outputs.targets) }}
    env:
      PACKAGE_DIR: ${{ matrix.target.dir }}
      PKG: ${{ matrix.target.pkg }}
      SCRIPT: ${{ matrix.target.script }}
      # Namespaced per plugin id: the action looks up the latest artifact by
      # name repo-wide, so a generic name would collide across plugins.
      MAIN_STATS_ARTIFACT: ${{ matrix.target.id }}-main-branch-stats
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          persist-credentials: false

      - name: Check out bundle-size report script
        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6
        with:
          repository: grafana/plugin-actions
          ref: a66a1c96cdbb176f9cccf10cf23593e250db7cce # bundle-size/v1.1.0
          path: .plugin-actions
          persist-credentials: false

      - uses: pnpm/action-setup@0977fd99725f1db4007ccb2928dbb4e90d06cc86 # v6
        with:
          package_json_file: plugins/package.json
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6
        with:
          node-version-file: plugins/.nvmrc
          cache: 'pnpm'
          cache-dependency-path: plugins/pnpm-lock.yaml

      - name: Install dependencies
        working-directory: plugins
        run: pnpm install --frozen-lockfile --prefer-offline

      - name: Build workspace dependencies
        working-directory: plugins
        run: pnpm turbo run build --filter "$PKG^..."

      - name: Build main branch stats
        if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        working-directory: ${{ matrix.target.dir }}
        run: pnpm run "$SCRIPT" --profile --json stats.json

      - name: Build PR stats
        if: github.event_name == 'pull_request'
        working-directory: ${{ matrix.target.dir }}
        run: pnpm run "$SCRIPT" --profile --json pr-stats.json

      - name: Upload main branch stats.json artifact
        if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
        uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7
        with:
          name: ${{ env.MAIN_STATS_ARTIFACT }}
          path: ${{ matrix.target.dir }}/stats.json
          overwrite: true

      - name: Get main stats artifact run-id
        if: github.event_name == 'pull_request'
        id: main-stats-info
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
        run: |
          MAIN_STATS_RUN_ID=$(gh api "/repos/${REPO}/actions/artifacts?name=${MAIN_STATS_ARTIFACT}" --jq ".artifacts | map(select(.name == \"${MAIN_STATS_ARTIFACT}\")) | sort_by(.created_at) | reverse | .[0].workflow_run.id")
          echo "run-id=${MAIN_STATS_RUN_ID}" >> "$GITHUB_OUTPUT"

      - name: Download main branch stats artifact
        if: github.event_name == 'pull_request' && steps.main-stats-info.outputs.run-id != ''
        uses: actions/download-artifact@3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c # v8
        with:
          name: ${{ env.MAIN_STATS_ARTIFACT }}
          path: ${{ matrix.target.dir }}
          github-token: ${{ github.token }}
          run-id: ${{ steps.main-stats-info.outputs.run-id }}

      - name: Generate stats report and comment on PR
        if: github.event_name == 'pull_request' && steps.main-stats-info.outputs.run-id != ''
        uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0
        with:
          script: |
            const script = require(`${process.env.GITHUB_WORKSPACE}/.plugin-actions/bundle-size/index.js`);
            const { THRESHOLD, PACKAGE_DIR } = process.env;
            await script({ github, context, core }, THRESHOLD, `${PACKAGE_DIR}/stats.json`, `${PACKAGE_DIR}/pr-stats.json`, PACKAGE_DIR);

      - name: Warn if main stats artifact could not be found
        if: github.event_name == 'pull_request' && steps.main-stats-info.outputs.run-id == ''
        run: echo "::warning title=Main stats artifact could not be found::No ${MAIN_STATS_ARTIFACT} artifact yet. Run this workflow on main (workflow_dispatch) or push a change to this plugin to main to generate it."
```

- [ ] **Step 2: Check one target's stats build locally**

From the repo root:
```bash
cd plugins/packages/@plugins/grafana-echarts && pnpm run build:relations --profile --json /tmp/relations-stats.json && jq -r '.outputPath' /tmp/relations-stats.json; cd -
```
Expected: exit 0 and an `outputPath` ending in `grafana-echarts/dist`. This confirms the extra args reach webpack through `pnpm run <script>`.

- [ ] **Step 3: Delete `echarts-bundle-stats.yml`**

```bash
git rm .github/workflows/echarts-bundle-stats.yml
```

- [ ] **Step 4: Lint**

`zizmor .github/workflows/plugin-bundle-stats.yml` reports nothing new compared with the deleted `echarts-bundle-stats.yml`. Same `actionlint` note as Task 6.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/plugin-bundle-stats.yml  # the git rm is already staged
git commit -m "feat(CI): generic per-target bundle stats workflow"
```

---

### Task 8: CLAUDE.md, point echarts docs at the generic workflows

**Files:**
- Modify: `CLAUDE.md`, the `### \`grafana-echarts\` is a special case too` section

- [ ] **Step 1: Replace the "nested `.github/` was removed" bullet**

Find the bullet that starts `- **Its nested \`.github/\` was removed; CI lives at root**`. It continues through the sentence ending "…were not ported." Replace the whole bullet with:

```markdown
- **Its nested `.github/` was removed; CI lives at root** in the generic `plugin-ci.yml` (levitate
  is-compatible per build target, Playwright e2e matrix via `plugin-e2e.yml`) and `plugin-bundle-stats.yml`,
  which run for every package. echarts only differs through its `plugin-ci.json`. The
  `grafana-enterprise@nightly` e2e job is `continue-on-error` (non-blocking); don't make it required. The
  bundle-stats workflow does **not** `uses:` `grafana/plugin-actions/bundle-size` — that action runs
  `pnpm install` at the repo root, which has no `package.json` — so it inlines the action's steps and
  calls its `index.js` report script from a pinned checkout. Bump both pins together. Its bundle-stats
  baseline is the relations bundle (the build target), not the app. The upstream
  `release.yml` (tag-triggered sign + validate of the standalone Relations build) and `cp-update.yml`
  (create-plugin update, which only works on a repo-root plugin) were not ported.
```

- [ ] **Step 2: Update the port-3020 bullet**

In the bullet starting `- **Its standalone dev/e2e stack (\`pnpm run server\` inside the package) defaults to port 3020**`, change the list `` `playwright.config.ts`, `docker-compose.yaml`, `echarts-ci.yml` and the `parity.md` live links `` to `` `playwright.config.ts`, `docker-compose.yaml`, `plugin-ci.json` (`e2e.url`) and the `parity.md` live links ``.

- [ ] **Step 3: Check for stale references**

```bash
grep -n "echarts-ci\|echarts-bundle-stats\|build-targets" CLAUDE.md .github -r
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: point echarts CI docs at the generic plugin workflows"
```

---

### Task 9: Verify on PR #19

**Files:** none.

- [ ] **Step 1: Push and watch**

```bash
git push
gh pr checks 19 --repo grafana/dataViz --watch
```

- [ ] **Step 2: Confirm the expected jobs ran and passed**

This PR changes the workflow files and `discover-plugins`, so nothing is filtered. Expected checks:
- **CI:** "Format, lint, type-check, test, build" passes, and its Build log still shows the 3 target groups.
- **Plugin CI:**
  - `compatibility (grafana-clock-panel)`, `compatibility (grafana-relations-panel)`, `compatibility (grafana-workspace-panel)` all pass.
  - `e2e (@plugins/grafana-clock-panel)` and `e2e (@plugins/grafana-echarts)` each have Build, Resolve e2e images and one job per Grafana version. Non-nightly versions pass. There is no e2e for workspace-panel.
- **Plugin bundle stats:** `bundle size (<id>)` for all 3 targets, each passing with the "Main stats artifact could not be found" warning (no main baseline yet).
- **zizmor:** passes.
- No `echarts CI` or `echarts bundle stats` runs for the new HEAD.

To read logs, find the run for the pushed SHA with `gh run list --repo grafana/dataViz --branch chore/ci-cd-testing --limit 10 --json databaseId,workflowName,headSha,conclusion`, then use `gh run view <id> --repo grafana/dataViz --log-failed`.

- [ ] **Step 3: If clock-panel e2e fails**

clock-panel's e2e has never run in this monorepo's CI. Capture the failing log lines (`--log-failed`), and do **not** change the workflow to make it pass. Report the failure with its decisive lines. It is either a real clock-panel e2e problem or a gap in the generic e2e convention, and the human decides which.
