# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo layout

Git root is this directory (`dataViz/`), **one level above** `plugins/`. All pnpm/turbo/docker commands run from `plugins/`, not the repo root — don't confuse `cd`-relative paths between the two.

```
dataViz-save/               # git root
├── SKILL-import-external.md  # procedure for importing external plugin repos w/ history preserved
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

Single package: `cd packages/@plugins/<name> && pnpm test` / `pnpm vitest run <file>` (workspace-panel and @shared/core use Vitest). `grafana-clock-panel` is the exception — see below.

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

Imported wholesale from `grafana/clock-panel` via `git filter-repo` (procedure in `SKILL-import-external.md`) with upstream git history preserved. It still runs its **original, separate toolchain** rather than this monorepo's conventions:

- Jest (not Vitest) — `pnpm test`, `pnpm test:ci`
- ESLint + Prettier (not Biome) — `pnpm lint`, `pnpm format`
- Its own webpack config under `.config/webpack/`, own `tsconfig.json` extending `@grafana/tsconfig`
- Playwright e2e tests (`pnpm e2e` / `pnpm playwright:test`)
- MIT license (vs. `UNLICENSED` elsewhere in this repo)

Do not assume `biome.json` / `vitest.config.base.mts` / `.shared/` conventions apply inside this package unless it has been explicitly migrated onto them.

## Adding a new plugin package

1. Copy the template: `cp -r packages/@plugins/grafana-workspace-panel packages/@plugins/<new-name>`
2. Update: `package.json` `name`; `src/plugin.json` `id`/`name`/metadata; `webpack.config.mjs` `PLUGIN_ID` and `uniqueName`; `tsconfig.json` `paths` alias
3. Add a reference in root `plugins/tsconfig.json`
4. If tests import the package, add an alias in `plugins/vitest.config.base.mts`
5. To load it in the Docker Grafana dev stack: add a `dist` volume in `docker-compose.yaml`, mount it in `docker-compose.grafana.yaml`, and add its id to `GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS`

## Adding a new shared package

1. `mkdir -p packages/@shared/<name>`, add `package.json` (with `exports`) and `tsconfig.json` extending `.shared/tsconfig.json`
2. Add a reference in root `plugins/tsconfig.json`
3. Add an alias in `.shared/webpack-shared.mjs` if plugins will import it via webpack

## Importing another external plugin repo with history preserved

Follow `SKILL-import-external.md` exactly — it documents the `git filter-repo` procedure (not `git subtree`) used for `grafana-clock-panel`, including the gotcha that the git repo root is one level above `plugins/`, so `--to-subdirectory-filter` paths must be `plugins/packages/@plugins/<name>`, not `packages/@plugins/<name>`.
