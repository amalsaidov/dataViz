# Generic per-plugin CI: compatibility, e2e, bundle stats

Follows `2026-10-06-build-targets-design.md`, which added `build-targets.json` and
`.github/actions/discover-build-targets` and is implemented on this branch.

## Problem

API compatibility (levitate), Playwright e2e and bundle-size reporting exist only for `grafana-echarts`,
in `echarts-ci.yml` and `echarts-bundle-stats.yml`, hardwired to that package. `grafana-clock-panel` has
none of them. Most future packages will look like clock-panel (one plugin, scaffolded create-plugin
layout), not like echarts, so these jobs should run for every package from one set of workflows, driven
by discovery plus convention, with per-package config only where convention can't decide.

## Design

### 1. `build-targets.json` becomes `plugin-ci.json`

Same file, renamed, now the per-package CI manifest. Optional; every key optional.

```json
{
  "targets": [
    { "id": "grafana-relations-panel", "script": "build:relations", "pluginJson": "src/modules/relations/plugin.json" }
  ],
  "e2e": { "url": "http://127.0.0.1:3020" }
}
```

- `targets`: unchanged semantics: absent means the implicit `src/plugin.json` / `build` target.
- `e2e.url`: where the package's own `docker-compose.yaml` exposes Grafana. Default
  `http://127.0.0.1:3000`. echarts sets 3020. clock-panel needs no file (its scaffolded
  `.config/docker-compose-base.yaml` hardcodes 3000).

### 2. `discover-build-targets` becomes `discover-plugins`

Same scan, two outputs:

- `targets`: unchanged: `[{dir, pkg, id, script, plugin_json}]`.
- `e2e`: `[{dir, pkg, url, grafana_dependency}]`, one per **package** (not target) that has both an `e2e`
  script and a `playwright.config.ts`. `grafana_dependency` is `src/plugin.json`
  `.dependencies.grafanaDependency`. A package with an `e2e` script but no config (or the reverse) is a
  discovery error. A package with neither is simply not in the list.

e2e is per package because a package's e2e suite tests whatever its own `docker-compose.yaml` mounts, the
`build` output. For echarts that is the app, not the relations target.

New input `changed-only` (default `false`). When `true`, both outputs are filtered to packages whose
directory changed, compared against `BASE` (PR: `github.event.pull_request.base.sha`; push:
`github.event.before`). If any of these changed, nothing is filtered:

- any path under `plugins/` that is outside the scanned plugin packages directory
  (`plugins/packages/@plugins/`): shared packages, lockfile, workspace config, `.shared/`, `turbo.json`,
  `biome.json`, `tsconfig.json`, `.npmrc`, and anything added later. This is an inverted allow-list on
  purpose: a new build-affecting file is covered without remembering to list it.
- `.github/actions/discover-plugins/**`
- `.github/workflows/plugin-ci.yml`, `plugin-e2e.yml`, `plugin-bundle-stats.yml`

The diff uses `--no-renames`, so a file moved between packages lists both its old and new paths.

If `BASE` is unavailable (all-zero `before` on a new branch, `workflow_dispatch`), nothing is filtered.
Callers using `changed-only` need `fetch-depth: 0` (or the base commit fetched).

Root `ci.yml` keeps `changed-only: false`.

### 3. `plugin-ci.yml` (replaces `echarts-ci.yml`)

Triggers: `pull_request` and `push` to `main`, `paths: plugins/**` plus the files in the
"nothing is filtered" list above.

- `discover`: checkout (`fetch-depth: 0`), `discover-plugins` with `changed-only: true`.
- `compatibility`: matrix over `targets`. Install, build workspace deps, `pnpm --filter <pkg> run <script>`,
  then `grafana/plugin-actions/is-compatible` on `<dir>/<dirname(plugin_json)>/module.ts` or `module.tsx`,
  whichever exists (neither is an error). Job name `compatibility (<id>)`. echarts checks relations only,
  as today.
- `e2e`: matrix over `e2e`, each calling reusable `.github/workflows/plugin-e2e.yml` with
  `dir`, `pkg`, `url`, `grafana_dependency`.

Jobs skip when their list is `[]`.

### 4. `plugin-e2e.yml` (reusable, `workflow_call`)

A port of `echarts-ci.yml`'s `build` / `resolve-versions` / `playwright-tests` jobs, parameterized:

- build with the package's `build` script, upload `dist/` as an artifact named after `dist/plugin.json` id
  and version
- `grafana/plugin-actions/e2e-version` with `grafana_dependency`
- Playwright matrix: `docker compose up -d` in `dir`, `wait-for-grafana` on `<url>/login`,
  `pnpm run e2e` with `GRAFANA_URL=<url>`, `docker compose logs` on failure, `docker compose down`.
  The `nightly` entry is `continue-on-error`, as now.

Reusable rather than inline because per-package version lists are matrix outputs, which can't feed a second
matrix within one workflow.

### 5. `plugin-bundle-stats.yml` (replaces `echarts-bundle-stats.yml`)

Same steps as `echarts-bundle-stats.yml`, as a matrix over `targets` from `discover-plugins`
(`changed-only: true`):

- build with `pnpm run <script> --profile --json <stats file>` in `dir`
- main artifact name `<id>-main-branch-stats`
- report script and pins unchanged

Behavior change: echarts' baseline is now the relations bundle (what ships), not the app. The first PR after
merge has no baseline, and the existing "main stats artifact could not be found" warning covers it.

### 6. Removed / updated

- Delete `echarts-ci.yml`, `echarts-bundle-stats.yml`.
- Root `ci.yml`: use `discover-plugins`.
- `CLAUDE.md`: the build-targets section becomes `plugin-ci.json`; echarts bullets that name
  `echarts-ci.yml` / `echarts-bundle-stats.yml` point at the generic workflows; the 3020 bullet lists
  `plugin-ci.json` instead of `echarts-ci.yml`.
- The user's untracked stock `is-compatible.yml` / `bundle-stats.yml` are not touched; the user deletes them.

No required status checks exist on `main`, so renaming jobs breaks no rule.

## Out of scope

- `typecheck` alias for `grafana/plugin-ci-workflows`
- Release / sign / publish
- Compatibility-checking echarts modules other than relations

## Verification

On PR #19:

- this PR touches the workflow files, so nothing is filtered. Expect `compatibility (grafana-clock-panel)`,
  `compatibility (grafana-relations-panel)`, `compatibility (grafana-workspace-panel)`; e2e for clock-panel
  and echarts (not workspace-panel); bundle stats for all three targets
- clock-panel e2e passes against `:3000`, echarts against `:3020`
- `discover-plugins` with `changed-only: true` checked locally against a synthetic base: a clock-only diff
  selects only clock-panel; a lockfile diff selects all
- `zizmor .github/workflows/` clean
