# Build Targets Implementation Plan

> Executed. Kept as a record; later review changes are not reflected here. For the current design, see
> `2026-10-06-generic-plugin-ci-design.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Root `ci.yml` builds exactly the plugins each package publishes, as declared by an optional per-package `build-targets.json`, so `grafana-echarts` builds `grafana-relations-panel` instead of the app.

**Architecture:** A composite action (`discover-build-targets`) scans `plugins/packages/@plugins/*`, reads each package's `build-targets.json` (or derives one implicit target from `src/plugin.json`), validates it, and emits a JSON array of targets. Root `ci.yml`'s Build step loops over that array sequentially: build workspace deps via turbo, run the target's script, assert `dist/plugin.json` has the target id.

**Tech Stack:** GitHub Actions composite action, bash, jq, pnpm, turbo 2.9.

**Spec:** `docs/superpowers/specs/2026-10-06-build-targets-design.md`

## Global Constraints

- Every `uses:` in `.github/workflows/*.yml` pinned to a commit SHA (`zizmor .github/workflows/` must be clean). Local actions use the repo's existing `$/.github/actions/<name>` form, as in `i18n-verify.yml`.
- No `${{ }}` expressions inside `run:` scripts. Pass values through `env:` (zizmor template-injection rule).
- Commit messages: conventional (`feat(CI): …`, `docs: …`), no `Co-Authored-By` or "Generated with" lines.
- Manifest file name: `build-targets.json`. Fields: `id`, `script`, `pluginJson`. Implicit default: `{ id: <src/plugin.json id>, script: "build", pluginJson: "src/plugin.json" }`.
- Target output fields: `dir`, `pkg`, `id`, `script`, `plugin_json`. `dir` is repo-root-relative (`plugins/packages/@plugins/<name>`).
- Id regex: `^[a-z0-9][a-z0-9-]*$`.
- Do not change echarts' `build` script, `echarts-ci.yml`, `echarts-bundle-stats.yml`, or `docker-compose*.yaml`.
- Do not commit the unrelated working-tree changes (`.claude/commands/import-external-plugin.md`, `.github/workflows/{bundle-stats,cp-update,is-compatible,release}.yml`). Stage files by explicit path only.

---

### Task 1: `discover-build-targets` action + echarts manifest

**Files:**
- Create: `.github/actions/discover-build-targets/discover.sh`
- Create: `.github/actions/discover-build-targets/action.yaml`
- Create: `plugins/packages/@plugins/grafana-echarts/build-targets.json`

**Interfaces:**
- Produces: `bash .github/actions/discover-build-targets/discover.sh <root>` prints a compact JSON array `[{dir, pkg, id, script, plugin_json}]` on stdout and exits 0, or prints `::error file=…::…` lines on stderr and exits 1 after reporting every error. The action exposes it as `steps.<id>.outputs.targets`.

- [ ] **Step 1: Write the echarts manifest**

`plugins/packages/@plugins/grafana-echarts/build-targets.json`:

```json
{
	"targets": [
		{
			"id": "grafana-relations-panel",
			"script": "build:relations",
			"pluginJson": "src/modules/relations/plugin.json"
		}
	]
}
```

Match the package's Prettier style: run `cd plugins && pnpm --filter @plugins/grafana-echarts exec prettier --write build-targets.json` after writing it.

- [ ] **Step 2: Write `discover.sh`**

`.github/actions/discover-build-targets/discover.sh`:

```bash
#!/usr/bin/env bash
# Prints every plugin build target under <root> as a compact JSON array:
#   [{dir, pkg, id, script, plugin_json}]
#
# A package declares its targets in build-targets.json. Without one it has a
# single implicit target: its src/plugin.json id, built by its `build` script.
# Every error is reported (as a GitHub annotation) before exiting 1, so one run
# shows them all.
set -euo pipefail
shopt -s nullglob # must precede the glob, or `set -u` sees the literal pattern

root="${1:?usage: discover.sh <root>}"
targets='[]'
failed=0

error() {
	echo "::error file=$1::$2" >&2
	failed=1
}

for pkg_json in "$root"/*/package.json; do
	dir="$(dirname "$pkg_json")"
	pkg="$(jq -r '.name' "$pkg_json")"
	manifest="$dir/build-targets.json"

	if [ -f "$manifest" ]; then
		declared="$(jq -c '.targets' "$manifest")"
		if ! jq -e 'type == "array" and length > 0' <<<"$declared" >/dev/null; then
			error "$manifest" "targets must be a non-empty array"
			continue
		fi
		source_file="$manifest"
	else
		root_id="$(jq -r '.id // ""' "$dir/src/plugin.json" 2>/dev/null || true)"
		if [ -z "$root_id" ]; then
			error "$pkg_json" "no build-targets.json and no id in src/plugin.json, so this package has no build target"
			continue
		fi
		declared="$(jq -nc --arg id "$root_id" '[{id: $id, script: "build", pluginJson: "src/plugin.json"}]')"
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
		if ! jq -e --arg s "$script" '.scripts | has($s)' "$pkg_json" >/dev/null; then
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
done

[ "$failed" -eq 0 ] || exit 1
echo "$targets"
```

- [ ] **Step 3: Run it against the real tree**

Run from the repo root:
```bash
bash .github/actions/discover-build-targets/discover.sh plugins/packages/@plugins | jq .
```
Expected: exit 0, exactly three entries:
- `@plugins/grafana-clock-panel`, `id` `grafana-clock-panel`, `script` `build`, `plugin_json` `src/plugin.json`
- `@plugins/grafana-echarts`, `id` `grafana-relations-panel`, `script` `build:relations`, `plugin_json` `src/modules/relations/plugin.json`
- `@plugins/grafana-workspace-panel`, `script` `build`, `plugin_json` `src/plugin.json`

Each `dir` should be `plugins/packages/@plugins/<name>`.

- [ ] **Step 4: Check every failure path against throwaway fixtures (not committed)**

```bash
F="$(mktemp -d)"
mk() { mkdir -p "$F/$1/src"; echo "{\"name\":\"@t/$1\",\"scripts\":{\"build\":\"x\"}}" > "$F/$1/package.json"; [ -z "$2" ] || echo "{\"id\":\"$2\"}" > "$F/$1/src/plugin.json"; }
mk ok ok-panel
mk noid ""
mk dup ok-panel
mk badscript bs-panel;  echo '{"targets":[{"id":"bs-panel","script":"build:nope","pluginJson":"src/plugin.json"}]}' > "$F/badscript/build-targets.json"
mk mismatch mm-panel;   echo '{"targets":[{"id":"other-panel","script":"build","pluginJson":"src/plugin.json"}]}' > "$F/mismatch/build-targets.json"
mk nofile nf-panel;     echo '{"targets":[{"id":"nf-panel","script":"build","pluginJson":"src/missing.json"}]}' > "$F/nofile/build-targets.json"
mk badid bad-panel;     echo '{"targets":[{"id":"Bad_Panel","script":"build","pluginJson":"src/plugin.json"}]}' > "$F/badid/build-targets.json"
mk empty e-panel;       echo '{"targets":[]}' > "$F/empty/build-targets.json"
bash .github/actions/discover-build-targets/discover.sh "$F"; echo "exit $?"
rm -rf "$F"
```
Expected: no JSON on stdout, `exit 1`, and seven `::error` lines:
- `badid`: must match
- `badscript`: `script 'build:nope' is not in`
- `ok`: `declared more than once`. Glob order is alphabetical, so `dup` claims `ok-panel` first and the error lands on `ok`.
- `empty`: `non-empty array`
- `mismatch`: `has id 'mm-panel'`
- `nofile`: `does not exist`
- `noid`: `no build target`

- [ ] **Step 5: Write `action.yaml`**

`.github/actions/discover-build-targets/action.yaml`:

```yaml
name: Discover build targets
description: Emit a JSON matrix of every plugin build target, from each package's build-targets.json or its implicit default.

inputs:
  root:
    description: 'Directory holding the plugin packages to scan.'
    required: false
    default: plugins/packages/@plugins

outputs:
  targets:
    description: |
      One entry per build target. Fields: dir (repo-root-relative package
      directory), pkg (package name), id (plugin id), script (package.json
      script that builds it into dist/), plugin_json (package-relative source
      plugin.json). See discover.sh for the rules.
    value: ${{ steps.find.outputs.targets }}

runs:
  using: 'composite'
  steps:
    - id: find
      shell: bash
      env:
        ROOT: ${{ inputs.root }}
        ACTION_PATH: ${{ github.action_path }}
      run: |
        set -euo pipefail
        targets="$(bash "$ACTION_PATH/discover.sh" "$ROOT")"
        jq . <<<"$targets"
        echo "targets=$targets" >> "$GITHUB_OUTPUT"
```

- [ ] **Step 6: Commit**

```bash
git add .github/actions/discover-build-targets/discover.sh .github/actions/discover-build-targets/action.yaml plugins/packages/@plugins/grafana-echarts/build-targets.json
git commit -m "feat(CI): discover per-package build targets"
```

---

### Task 2: Root `ci.yml` builds the discovered targets

**Files:**
- Modify: `.github/workflows/ci.yml` (the `Build` step at the end of the `check` job)

**Interfaces:**
- Consumes: `$/.github/actions/discover-build-targets` → `steps.targets.outputs.targets`, JSON `[{dir, pkg, id, script, plugin_json}]` (Task 1).

- [ ] **Step 1: Replace the Build step**

In `.github/workflows/ci.yml`, replace:

```yaml
      - name: Build
        run: pnpm build
```

with:

```yaml
      # Builds what each package publishes, per its build-targets.json (or the
      # implicit src/plugin.json + `build` target), rather than every
      # package's `build` script. Sequential: targets of one package share
      # dist/, so they cannot build concurrently.
      - name: Discover build targets
        id: targets
        uses: $/.github/actions/discover-build-targets
      - name: Build
        env:
          TARGETS: ${{ steps.targets.outputs.targets }}
        run: |
          set -euo pipefail
          count="$(jq 'length' <<<"$TARGETS")"
          for ((i = 0; i < count; i++)); do
            dir="$(jq -r ".[$i].dir" <<<"$TARGETS")"
            pkg="$(jq -r ".[$i].pkg" <<<"$TARGETS")"
            id="$(jq -r ".[$i].id" <<<"$TARGETS")"
            script="$(jq -r ".[$i].script" <<<"$TARGETS")"

            echo "::group::$pkg → $id"
            # `^...` builds the package's workspace dependencies but not the
            # package itself; exits 0 when it has none.
            pnpm turbo run build --filter "$pkg^..."
            pnpm --filter "$pkg" run "$script"
            built="$(jq -r '.id // ""' "$GITHUB_WORKSPACE/$dir/dist/plugin.json")"
            echo "::endgroup::"

            if [ "$built" != "$id" ]; then
              echo "::error file=$dir/dist/plugin.json::$pkg script '$script' built '$built', expected '$id'"
              exit 1
            fi
          done
```

- [ ] **Step 2: Run the loop locally**

From `plugins/`, with a clean dist so stale output can't satisfy the id check:

```bash
rm -rf packages/@plugins/*/dist
export GITHUB_WORKSPACE="$(git rev-parse --show-toplevel)"
# Run from the repo root with the relative root, as the action does, so `dir` is repo-relative.
export TARGETS="$(cd "$GITHUB_WORKSPACE" && bash .github/actions/discover-build-targets/discover.sh plugins/packages/@plugins)"
```

Then paste the body of the `run: |` block from Step 1 into the shell (or save it to `/tmp/build-loop.sh` and `bash /tmp/build-loop.sh`).

Expected: three groups (`@plugins/grafana-clock-panel → grafana-clock-panel`, `@plugins/grafana-echarts → grafana-relations-panel`, `@plugins/grafana-workspace-panel → grafana-workspace-panel`, the last with an `@shared/core` build first), exit 0, and `jq -r .id packages/@plugins/grafana-echarts/dist/plugin.json` prints `grafana-relations-panel`.

- [ ] **Step 3: Lint the workflow**

Run from the repo root: `zizmor .github/workflows/ci.yml`
Expected: no findings. If zizmor flags anything in an *existing* line, leave it and note it. Only new lines are in scope.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "feat(CI): build each package's declared targets in root CI"
```

---

### Task 3: Document `build-targets.json` in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`: add a section after "## Adding a new shared package" and before "## GitHub Actions workflows". Also add one bullet to the `grafana-echarts` special-case list.

- [ ] **Step 1: Add the section**

Insert before `## GitHub Actions workflows`:

~~~markdown
## Build targets (`build-targets.json`)

Root `ci.yml` builds what each package **publishes**, not every package's `build` script. The list
comes from `.github/actions/discover-build-targets`, which reads an optional
`build-targets.json` at each `packages/@plugins/<pkg>/` root:

```json
{ "targets": [{ "id": "grafana-relations-panel", "script": "build:relations", "pluginJson": "src/modules/relations/plugin.json" }] }
```

- **No file** means one implicit target: `src/plugin.json`'s id, built by `build`. Most packages need nothing.
- **Only listed targets are built.** A package that lists targets loses its implicit one. To keep
  building the default too, list it explicitly.
- Discovery fails CI if `script` isn't in `package.json`, if `pluginJson`'s id differs from `id`, or if an id is
  duplicated. After each build, CI also checks that `dist/plugin.json` has the target's id.
- Targets build one at a time because a package's targets share `dist/`.
~~~

- [ ] **Step 2: Add the echarts bullet**

In the `### grafana-echarts is a special case too` list, after the "**Two `plugin.json`s ship on their own:**" bullet, add:

```markdown
- **Root CI builds `grafana-relations-panel`, not the app.** Its `build-targets.json` lists only the
  relations target (`build:relations`). `build` itself is still the app build, used by the dev stack,
  `echarts-ci.yml` e2e and bundle stats. Adding another standalone module needs a `build:<module>` script
  **and** webpack support (`--env standalone=<module>` currently accepts only `relations`), plus a target
  entry. To build the app in root CI too, add `{ "id": "grafana-echarts-app", "script": "build", "pluginJson": "src/plugin.json" }`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: describe build-targets.json"
```

---

### Task 4: Verify on PR #19

**Files:** none permanently. Each breaking commit below is reverted.

- [ ] **Step 1: Push and check the happy path**

```bash
git push
gh pr checks 19 --watch
```
Expected: "Format, lint, type-check, test, build" passes. In its log (`gh run view <run-id> --log | grep -E '::group::|→'`), the Build step shows three groups. The echarts group is `@plugins/grafana-echarts → grafana-relations-panel` and runs `build:relations`. zizmor passes.

- [ ] **Step 2: Prove the guards fail loudly, one breaking commit at a time**

For each case: make the edit, `git commit -am "test: <case>"`, `git push`, wait with `gh pr checks 19 --watch`, confirm the failure and its annotation, then `git revert --no-edit HEAD && git push`.

| case | edit | expected failure |
|---|---|---|
| bad script | echarts `build-targets.json` `script` → `build:nope` | Discover step: `script 'build:nope' is not in` |
| id mismatch | echarts `build-targets.json` `id` → `grafana-relations-panelx` | Discover step: `has id 'grafana-relations-panel'` |
| duplicate | in echarts `build-targets.json`, append a second target identical to the first | Discover step: `declared more than once` |
| wrong dist | echarts `build-targets.json` `script` → `build` (the app build) with `id` unchanged | Build step: `built 'grafana-echarts-app', expected 'grafana-relations-panel'` |

The "bad script" and "id mismatch" cases were already exercised locally in Task 1 Step 4. If time is short, the CI-side runs that matter most are "wrong dist" (the only guard that can't be tested without a build) and one discover failure, to confirm annotations surface in the PR.

- [ ] **Step 3: Confirm the branch is clean**

```bash
git log --oneline origin/main..HEAD
git diff origin/main --stat
```
Expected: the net diff is only the spec, the plan, the action (2 files), `build-targets.json`, `ci.yml`, and `CLAUDE.md`. Test and revert commits are present but net to zero.
