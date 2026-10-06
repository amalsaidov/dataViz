# Build targets: what CI builds per plugin package

> Superseded in part by `2026-10-06-generic-plugin-ci-design.md`: `build-targets.json` is now `plugin-ci.json`, and
> `discover-build-targets` is now `discover-plugins`. The build-target rules below still apply.

## Problem

Root `ci.yml` builds every package with `pnpm build` (turbo), which runs each package's `build` script.
For `grafana-echarts` that is the app (`grafana-echarts-app`), but the plugin that actually ships from
that package today is `grafana-relations-panel`, built by `build:relations`. Later the same package
will publish more standalone module panels, and eventually the app as well. That makes it a
monorepo inside the monorepo: one package directory, several publishable plugins.

Releases will run through our own workflows, not `grafana/plugin-ci-workflows`, whose frontend action
hardcodes `run build` in a single `plugin-directory` and assumes one plugin per directory.

## Design

### Manifest: `build-targets.json`

Optional file at a package root (`plugins/packages/@plugins/<pkg>/build-targets.json`):

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

- `id`: the plugin id. Must equal the `id` in `pluginJson`.
- `script`: the `package.json` script that builds this target into `dist/`. Must exist.
- `pluginJson`: package-relative path to this target's source `plugin.json`.

A package **without** the file has one implicit target:
`{ id: <src/plugin.json id>, script: "build", pluginJson: "src/plugin.json" }`.
`grafana-clock-panel` and `grafana-workspace-panel` stay on this default.

**Only listed targets are built.** `grafana-echarts` lists only relations, so root CI stops building
the echarts app until the app is added as a target
(`{ "id": "grafana-echarts-app", "script": "build", "pluginJson": "src/plugin.json" }`).

Every target writes to `dist/`, so two targets of the same package must never build at the same
time in the same checkout. Each one builds and is verified before the next starts.

JSON rather than a `package.json` field, so workflows read it with `jq` and the echarts webpack
config can read it later too (e.g. to validate `--env standalone=<x>` instead of its hardcoded
`relations` check).

### Discovery: `.github/actions/discover-build-targets`

Composite action modeled on `discover-i18n-packages`: input `root` (default
`plugins/packages/@plugins`), one bash + `jq` step, no checkout of its own (callers check out the repo first).

Output `targets`: JSON array, one entry per target, implicit targets included:
`[{dir, pkg, id, script, plugin_json}]`.

It fails with an `::error file=…::` annotation when:

- `script` is not a key of the package's `package.json` `scripts` (turbo and `pnpm --filter` both
  exit 0 on a missing script, so this is the only place a typo would be caught)
- the `id` in `pluginJson` does not equal the target `id`, or `pluginJson` is missing
- an `id` does not match `^[a-z0-9][a-z0-9-]*$`
- the same `id` appears twice anywhere under `root`
- a package has neither `build-targets.json` nor an `id` in `src/plugin.json`

The future release workflow uses the same output as its matrix, so root CI and release agree on
what gets built.

### Root `ci.yml`

Only the `Build` step changes. Format, lint, type-check and test stay on turbo across all packages.

The discover action runs in the same job, after checkout. The Build step loops over `targets`
**sequentially**. For each target:

1. `::group::<pkg> → <id>`
2. `pnpm turbo run build --filter '<pkg>^...'`: build the target's workspace dependencies
   (preserves `^build` ordering) without building the package itself
3. `pnpm --filter <pkg> run <script>`
4. assert `<dir>/dist/plugin.json` `.id` equals the target `id`; on mismatch, fail with the expected
   and actual ids. This catches a build that put the wrong plugin into `dist/`, e.g. a broken
   standalone path silently building the app.

The loop lives in `.github/scripts/build-targets.sh`. It also fails when no targets were discovered, or when a
build writes no `dist/plugin.json`. The step runs under `set -euo pipefail`. Sequential rather than a matrix: one `pnpm install`, and the
`dist/` collision cannot happen. The release workflow will use a matrix, where per-job isolation is
worth the extra installs.

Trade-off: root CI loses turbo's parallel build across packages. That costs little at three packages
with no remote cache.

### Unchanged

- echarts' `build` script stays the app build. The dev-stack precache (`pnpm build` into
  `echarts-app-dist`), `echarts-ci.yml` e2e, `echarts-bundle-stats.yml`, and `server:lgtm` keep
  working as they do today.
- `@shared/core` is not a plugin, so it isn't scanned. It still gets built as a dependency of the
  plugins that import it (step 2), and type-check covers it regardless.

### Docs

Add a short `CLAUDE.md` section: what `build-targets.json` is, the implicit default, that only listed
targets are built, and that adding a standalone target needs both a `build:<x>` script and webpack
`standalone` support for it.

## Out of scope

- The release / sign / publish workflow (will consume `discover-build-targets`)
- Standalone builds for echarts modules other than relations (webpack work)
- Adding `grafana-echarts-app` as a target
- A `typecheck` alias for `grafana/plugin-ci-workflows` compatibility
- Cross-checking `build-targets.json` ids against `crowdin.yml`'s `x_dataviz.plugins`. Both lists name
  a package's plugins, but merging them would tie the build to i18n opt-in.

## Verification

On PR #19, no committed fixtures:

- the echarts group logs `@plugins/grafana-echarts → grafana-relations-panel` and runs `build:relations`, not the app build
- clock-panel and workspace-panel build through their implicit `build` target
- each discover validation and the `dist/plugin.json` assertion is shown to fail by a temporary
  breaking commit (bad script name, mismatched id, duplicate id, wrong `pluginJson`), then reverted
