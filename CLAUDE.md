# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Git root is this directory (`dataViz/`), **one level above** `plugins/`. All pnpm/turbo/docker commands run from `plugins/`, not the repo root — don't confuse `cd`-relative paths between the two.

```
dataViz/                    # git root
├── .claude/commands/        # import-external-plugin.md, resign-imported-history.md
├── .github/workflows/       # CI — the ONLY place GitHub Actions discovers workflows
└── plugins/                 # pnpm workspace root — run all commands from here
    ├── .shared/              # shared tsconfig/webpack config
    ├── packages/
    │   ├── @shared/core/               # @shared/core — shared utilities package
    │   └── @plugins/
    │       ├── grafana-workspace-panel/  # template/example panel plugin (this monorepo's build system)
    │       └── grafana-clock-panel/      # imported from grafana/clock-panel (own toolchain, see below)
    ├── provisioning/         # Grafana datasource/dashboard provisioning for docker dev stack
    ├── docker-compose.yaml           # plugin build/watch stack
    └── docker-compose.grafana.yaml   # Grafana instance stack (attaches to the build)
```

This monorepo is scoped to **panel and app plugins only** — no Go backend plugin tooling.

## Commands (run from `plugins/`)

```bash
pnpm install

pnpm build          # turbo build (production, all packages)
pnpm build:dev      # turbo build:dev
pnpm dev            # turbo dev (watch mode)
pnpm test           # turbo test
pnpm test:ci        # turbo test:ci
pnpm lint           # turbo lint (biome)
pnpm lint:fix
pnpm format         # biome format check
pnpm format:fix
pnpm type-check     # turbo type-check (tsc --build, project references)
pnpm check          # format + test:ci + lint + type-check — run before considering work done
```

Single package: `cd packages/@plugins/<name> && pnpm test` (watch) / `pnpm test:ci`, or from `plugins/` use `pnpm --filter <pkg> run test:ci`.

**Every package uses Jest.** There is no Vitest in this repo — each package has its own `jest.config.js` (`@swc/jest` transform, jsdom for the panel plugins, node for `@shared/core`). Panel plugin configs must set `jsc.transform.react.runtime: 'automatic'` to match webpack; source files import React as a type only, so the classic runtime fails at test time with `React is not defined`.

### Local dev stack (Docker, two terminals)

```bash
pnpm run plugin   # terminal 1: docker compose up — builds/watches all plugins into shared dist volumes
pnpm run server   # terminal 2: docker compose -f docker-compose.grafana.yaml up — Grafana on :3001
```

`pnpm run plugin` must be running and have completed its initial build before starting `pnpm run server`. Multiple Grafana instances can attach to the same shared plugin build on different ports/versions simultaneously:

```bash
GRAFANA_VERSION=13.1.0 GRAFANA_PORT=3002 pnpm run server
```

Each invocation is its own Docker Compose project (namespaced by `GRAFANA_CONTAINER_NAME`, derived from `GRAFANA_PORT`), so instances don't clobber each other's data volumes.

## Architecture

- **Ejected build system** — no `@grafana/create-plugin` abstraction. Webpack, TypeScript project references, and Turborepo task graph are all hand-maintained under `plugins/.shared/` and per-package `webpack.config.mjs`/`tsconfig.json`.
- **Turborepo** orchestrates tasks (`build`, `test`, `lint`, `type-check`, etc.) across packages per `plugins/turbo.json`; `build` and `build-types` depend on upstream packages' same task (`^build`).
- **pnpm workspace** covers `packages/*`, `packages/@shared/*`, `packages/@plugins/*` (see `plugins/pnpm-workspace.yaml`).
- **Cross-package imports** use workspace aliases, e.g. `import { something } from '@shared/core'` — backed by `workspace:*` deps plus TS path aliases and webpack aliases in `.shared/webpack-shared.mjs`.
- **Panel plugin entry point** convention (see `grafana-workspace-panel`): `src/module.ts` exports the `PanelPlugin` + options builder, `src/components/<Name>.tsx` is the main render component (`PanelProps`, `useTheme2`), `src/types.ts` holds panel options, `src/plugin.json` holds metadata (`type: panel`).
- **Biome** (not ESLint/Prettier) lints and formats packages built on this monorepo's own toolchain: tabs, single quotes, semicolons, 120 col width, `noExplicitAny`/`noUnusedImports`/`useHookAtTopLevel` etc. as errors. Config at `plugins/biome.json`.

### `grafana-clock-panel` is a special case

Imported wholesale from `grafana/clock-panel` via `git filter-repo` (procedure in
`.claude/commands/import-external-plugin.md`) with upstream git history preserved. It still runs its
**original, separate toolchain** rather than this monorepo's conventions:

- ESLint + Prettier (not Biome) — `pnpm lint`, `pnpm format`
- Its own webpack config under `.config/webpack/`, own `tsconfig.json` extending `@grafana/tsconfig`
- Playwright e2e tests (`pnpm e2e` / `pnpm playwright:test`)
- MIT license (vs. `UNLICENSED` elsewhere in this repo)

Do not assume `biome.json` / `.shared/` conventions apply inside this package unless it has been explicitly migrated onto them. (Jest is *not* a difference — the whole repo uses Jest.)

**Deliberately NOT wired into the root `plugins/tsconfig.json` references**, despite "Adding a new plugin package" saying to: TS project references require `composite: true` on the referenced project. clock-panel's config resolves to `composite` unset and `declaration: false`, and the file that would have to change (`.config/tsconfig.json`) is scaffolded by `@grafana/create-plugin` and marked do-not-edit. Root `tsconfig.json` only exists to help VSCode intellisense, so it isn't worth forcing declaration emit for.

**It keeps a `packageManager` field even though the workspace root has one.** A nested `packageManager` is normally inert — only the root's governs corepack — so it reads as dead weight. It isn't: Grafana's shared plugin CD workflow (`grafana/plugin-ci-workflows/.github/workflows/cd.yml`) supports monorepos via a `plugin-directory` input, and its setup action passes `package_json_file: <plugin-directory>/package.json` to `pnpm/action-setup`, which hard-errors with `No pnpm version is specified` if the field is missing. Keep it in sync with `plugins/package.json`.

**Its scripts are wired to this repo's turbo task names** (`type-check`, not `typecheck`; `format` checks, `format:fix` writes). Turbo matches tasks to scripts **by exact name and silently skips misses** — a renamed script means the package stops being checked, with a green build and no warning.

`src/external/**` (vendored) and `src/locales/**` (Crowdin-generated) are excluded from Prettier via `.prettierignore`, matching eslint's existing `src/external/**` ignore.

## Adding a new plugin package

1. Copy the template: `cp -r packages/@plugins/grafana-workspace-panel packages/@plugins/<new-name>`
2. Update: `package.json` `name`; `src/plugin.json` `id`/`name`/metadata; `webpack.config.mjs` `PLUGIN_ID` and `uniqueName`; `tsconfig.json` `paths` alias
3. Add a reference in root `plugins/tsconfig.json`
4. Copy `jest.config.js`, `jest-setup.js`, `jest/mocks/`, and `types/jest-dom.d.ts` from the template. If the plugin imports a workspace package, add it to `moduleNameMapper` (see how `@shared/core` is mapped) — Jest does not read the webpack/TS path aliases.
5. To load it in the Docker Grafana dev stack: add a `dist` volume in `docker-compose.yaml`, mount it in `docker-compose.grafana.yaml`, and add its id to `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`

## Adding a new shared package

1. `mkdir -p packages/@shared/<name>`, add `package.json` (with `exports`) and `tsconfig.json` extending `.shared/tsconfig.json`
2. Add a reference in root `plugins/tsconfig.json`
3. Add an alias in `.shared/webpack-shared.mjs` if plugins will import it via webpack

## GitHub Actions workflows

Grafana's org-wide `zizmor` CI check requires every `uses:` action reference in
`.github/workflows/*.yml` to be pinned to a commit hash, not a mutable tag
(`@v6` etc.) — tags can be silently repointed by a compromised upstream. Check
before pushing workflow changes:

```bash
zizmor .github/workflows/
```

(`brew install zizmor` if not already installed.) Get a tag's current commit
hash with:

```bash
gh api repos/<owner>/<repo>/git/refs/tags/<tag> --jq '.object.sha'
```

and pin as `uses: <owner>/<repo>@<sha> # <tag>`.

## Importing another external plugin repo with history preserved

Follow `.claude/commands/import-external-plugin.md` exactly — it documents the `git filter-repo` procedure (not `git subtree`) used for `grafana-clock-panel`, including the gotcha that the git repo root is one level above `plugins/`, so `--to-subdirectory-filter` paths must be `plugins/packages/@plugins/<name>`, not `packages/@plugins/<name>`.

Its "What comes along with an import" section is the important part — a standalone repo bakes its identity into many files (lockfile, `packageManager`, `.npmrc`, renovate config, nested `.github/workflows`, `overrides`/`resolutions`, Vault paths, external project ids), and **almost none of them fail loudly** when they stop working. If the target repo requires signed commits, also see `.claude/commands/resign-imported-history.md`.
