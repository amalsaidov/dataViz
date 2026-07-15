# Grafana Workspace Plugin - Minimal Ejected Structure

A minimal Grafana plugin monorepo template using the "ejected" approach from grafana-irm. This provides full control over the build system, dependencies, and tooling.

## Structure

```
workspace-investigation/
├── .shared/                    # Shared build configurations
│   ├── tsconfig.base.json     # Base TypeScript config (strict)
│   ├── tsconfig.json          # Shared packages TS config
│   └── webpack-shared.mjs     # Shared webpack config
├── packages/
│   ├── @shared/               # Shared libraries
│   │   └── core/              # Core utilities
│   │       ├── src/
│   │       ├── package.json
│   │       └── tsconfig.json
│   └── @plugins/              # Grafana plugins
│       └── grafana-workspace-app/
│           ├── src/           # Plugin source
│           │   ├── components/
│           │   ├── img/
│           │   ├── module.tsx
│           │   └── plugin.json
│           ├── pkg/           # Go backend
│           │   ├── main.go
│           │   └── plugin/
│           ├── package.json
│           ├── tsconfig.json
│           ├── webpack.config.mjs
│           ├── go.mod
│           └── Magefile.go
├── package.json               # Root workspace
├── pnpm-workspace.yaml        # pnpm workspace config
├── turbo.json                 # Turborepo config
├── tsconfig.json              # Root TS project references
├── biome.json                 # Biome.js linting/formatting
├── vitest.config.base.mts     # Shared Vitest config
└── vitest.setup.ts            # Vitest setup
```

## Tech Stack

- **Package Manager**: pnpm with workspaces
- **Build System**: Turborepo for orchestration, Webpack for bundling
- **TypeScript**: Strict mode with composite builds
- **Testing**: Vitest
- **Linting/Formatting**: Biome.js
- **Backend**: Go with grafana-plugin-sdk-go

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 10+
- Go 1.23+
- Mage (for Go builds)

### Installation

```bash
# Install dependencies
pnpm install

# Install Mage (if not already installed)
go install github.com/magefile/mage@latest
```

### Development with Docker Compose (Recommended)

The easiest way to develop is using Docker Compose, which sets up Grafana with the plugin automatically:

```bash
# Start Grafana with the plugin
docker compose up

# Access Grafana at http://localhost:3000
# Go to Administration > Plugins > Workspace to enable the plugin
```

The Docker Compose setup:
- Builds both frontend (webpack) and backend (Go)
- Watch mode auto-rebuilds on source changes
- Mounts the dist folder into Grafana
- Enables anonymous access (no login required)
- Auto-provisions the plugin (may take 30-60 seconds after Grafana starts)

**Note**: Grafana starts immediately, but the plugin takes ~30-60 seconds to build. Once ready, it will appear in the sidebar automatically or you can enable it manually from **Administration > Plugins**.

### Local Development

If you prefer to develop locally without Docker:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Build in development mode
pnpm build:dev

# Watch mode for development
pnpm dev

# Run tests
pnpm test

# Lint
pnpm lint

# Format code
pnpm format:fix

# Type check
pnpm type-check

# Build Go backend
pnpm build:proxy
```

Then manually link the `packages/@plugins/grafana-workspace-app/dist` folder to your Grafana plugins directory.

### Project Commands

All commands use Turborepo to orchestrate tasks across packages:

- `pnpm build` - Production build of all packages
- `pnpm build:dev` - Development build
- `pnpm dev` - Watch mode for development
- `pnpm test` - Run tests
- `pnpm test:ci` - Run tests in CI mode
- `pnpm lint` - Lint all packages
- `pnpm format` - Check formatting
- `pnpm format:fix` - Fix formatting
- `pnpm type-check` - TypeScript type checking
- `pnpm clean` - Clean build artifacts
- `pnpm build:proxy` - Build Go backend

## Plugin Structure

### Frontend (React/TypeScript)

- **Entry Point**: `src/module.tsx` - Exports the AppPlugin
- **Main Component**: `src/components/App.tsx` - Root app component
- **Plugin Metadata**: `src/plugin.json` - Grafana plugin configuration
- **Shared Code**: Uses `@shared/core` for utilities

### Backend (Go)

- **Entry Point**: `pkg/main.go` - Plugin main function
- **Plugin Logic**: `pkg/plugin/plugin.go` - Resource handlers
- **Build**: Uses Mage for cross-platform builds
- **Health Check**: Built-in health endpoint

### Build System

- **Webpack**: Bundles plugin as AMD module for Grafana
- **SWC**: Fast TypeScript/JSX compilation
- **TypeScript**: Project references for cross-package types
- **Turbo**: Parallel builds with caching

## Adding New Packages

### Shared Package

1. Create `packages/@shared/<name>/`
2. Add `package.json` with exports
3. Add `tsconfig.json` extending `.shared/tsconfig.json`
4. Update root `tsconfig.json` references
5. Update aliases in `.shared/webpack-shared.mjs`

### Plugin Package

1. Create `packages/@plugins/<name>/`
2. Copy structure from `grafana-workspace-app`
3. Update `plugin.json` with unique ID
4. Update `package.json` name and scripts
5. Update `go.mod` module path

## Key Features

- **Monorepo**: Multiple packages with shared code
- **Full Control**: No abstraction over build tools
- **Type Safety**: Strict TypeScript with project references
- **Fast Builds**: Turborepo caching + SWC compilation
- **Go Backend**: Plugin proxy for API calls
- **Modern Tools**: Biome.js for linting/formatting

## Differences from @grafana/create-plugin

This "ejected" approach differs from the standard `@grafana/create-plugin`:

- ✅ Full control over webpack configuration
- ✅ Monorepo support with shared packages
- ✅ Custom build pipeline with Turborepo
- ✅ Strict TypeScript configuration
- ✅ Modern tooling (Biome.js, SWC)
- ❌ More manual configuration required
- ❌ No automatic updates from @grafana/create-plugin

## License

UNLICENSED
