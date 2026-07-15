# Grafana Plugin Monorepo Template

A production-ready template for building Grafana plugins in a monorepo structure. This template provides a fully ejected build system with complete control over configuration, ideal for organizations building multiple related plugins or plugins with shared code.

## Features

- **Monorepo Architecture** - Multiple plugins and shared packages in one repository
- **Full Build Control** - Ejected webpack and build configurations, no hidden abstractions
- **Modern Toolchain** - Turborepo, pnpm workspaces, SWC, TypeScript, Biome.js
- **Backend Support** - Go plugin backend with grafana-plugin-sdk-go
- **Type Safety** - Strict TypeScript with composite builds and project references
- **Fast Development** - Docker Compose setup with hot reload for frontend and backend
- **Testing Ready** - Vitest configured for all packages
- **Production Ready** - Optimized builds with caching via Turborepo

## Quick Start

### Use This Template

1. Click "Use this template" on GitHub or clone this repository:
   ```bash
   git clone <your-repo-url>
   cd monorepo-plugin-template
   ```

2. Install dependencies:
   ```bash
   cd plugins
   pnpm install
   ```

3. Start development environment:
   ```bash
   docker compose up
   ```

4. Access Grafana at http://localhost:3000
   - The plugin builds automatically (takes 30-60 seconds)
   - Find it at **Administration > Plugins > Workspace**

## Prerequisites

- **Node.js** 18 or later
- **pnpm** 10 or later
- **Go** 1.23 or later (for backend plugins)
- **Docker** (for local development environment)
- **Mage** (for Go builds): `go install github.com/magefile/mage@latest`

## Repository Structure

```
monorepo-plugin-template/
└── plugins/                          # Main workspace directory
    ├── .shared/                      # Shared build configurations
    │   ├── tsconfig.base.json       # Base TypeScript config
    │   ├── tsconfig.json            # Shared packages config
    │   └── webpack-shared.mjs       # Shared webpack config
    ├── packages/
    │   ├── @shared/                 # Shared libraries
    │   │   └── core/                # Core utilities package
    │   └── @plugins/                # Grafana plugins
    │       └── grafana-workspace-app/  # Example plugin
    ├── provisioning/                # Grafana provisioning
    ├── docker-compose.yaml          # Local development setup
    ├── package.json                 # Root workspace
    ├── pnpm-workspace.yaml          # pnpm workspace config
    ├── turbo.json                   # Turborepo orchestration
    └── biome.json                   # Linting/formatting config
```

## Customizing for Your Plugins

### 1. Rename the Example Plugin

```bash
cd plugins/packages/@plugins
mv grafana-workspace-app your-plugin-name
```

Update these files in your renamed plugin:
- `package.json` - Change the name field
- `src/plugin.json` - Update id, name, and other metadata
- `go.mod` - Update the module path

### 2. Update Root Configuration

In `plugins/package.json`:
- Update the name field
- Update repository, author, and license fields

### 3. Add Additional Plugins

Create a new plugin by copying the structure:
```bash
cp -r packages/@plugins/grafana-workspace-app packages/@plugins/your-new-plugin
```

Then update the configuration files as described above.

### 4. Add Shared Packages

Create shared code that multiple plugins can use:
```bash
mkdir -p packages/@shared/your-package-name
```

Add a `package.json` and `tsconfig.json`, then import in your plugins:
```typescript
import { something } from '@shared/your-package-name';
```

## Development Workflow

### Docker Compose (Recommended)

The Docker Compose setup provides the fastest way to develop:

```bash
cd plugins
docker compose up
```

This automatically:
- Builds frontend (webpack) and backend (Go)
- Watches for changes and rebuilds
- Runs Grafana with the plugin mounted
- Provisions the plugin for immediate use

### Local Development

For development without Docker:

```bash
cd plugins

# Build everything
pnpm build

# Development mode with watch
pnpm dev

# Run tests
pnpm test

# Type checking
pnpm type-check

# Linting
pnpm lint

# Format code
pnpm format:fix
```

### Available Commands

All commands are orchestrated by Turborepo for optimal caching and parallelization:

- `pnpm build` - Production build
- `pnpm build:dev` - Development build
- `pnpm dev` - Watch mode
- `pnpm test` - Run tests
- `pnpm test:ci` - CI test mode
- `pnpm lint` - Lint code
- `pnpm format` - Check formatting
- `pnpm format:fix` - Fix formatting
- `pnpm type-check` - TypeScript checking
- `pnpm build:proxy` - Build Go backend
- `pnpm clean` - Clean build artifacts
- `pnpm check` - Run all checks (format, test, lint, type-check)

## Technology Stack

### Build & Package Management
- **pnpm** - Fast, disk-efficient package manager with workspace support
- **Turborepo** - High-performance build system with intelligent caching
- **Webpack 5** - Module bundler configured for Grafana plugins

### Languages & Frameworks
- **TypeScript 5.7** - Strict mode with composite builds
- **React 18** - UI framework (from Grafana)
- **Go 1.23** - Backend plugin support

### Development Tools
- **SWC** - Fast TypeScript/JSX compiler
- **Biome.js** - Fast linting and formatting
- **Vitest** - Fast unit testing
- **Docker Compose** - Local development environment

### Grafana Integration
- **@grafana/data** - Data manipulation utilities
- **@grafana/runtime** - Runtime services
- **@grafana/ui** - UI components
- **grafana-plugin-sdk-go** - Go backend SDK

## Key Differences from @grafana/create-plugin

This template uses an "ejected" approach that differs from the standard `@grafana/create-plugin`:

### Advantages
- Full control over webpack, TypeScript, and build configurations
- Monorepo support with shared packages
- Custom build pipeline optimized for your needs
- Modern tooling (Turborepo, SWC, Biome.js)
- Ability to build multiple plugins that share code

### Trade-offs
- More manual configuration required
- No automatic updates from @grafana/create-plugin
- Need to maintain build configuration yourself
- More complex initial setup

## Documentation

For detailed documentation on the workspace structure, plugin development, and build system, see:

- [plugins/README.md](./plugins/README.md) - Comprehensive workspace documentation
- Plugin-specific README files in `packages/@plugins/*`
- Shared package documentation in `packages/@shared/*`

## Continuous Integration

The build system is designed to work well with CI/CD:

```yaml
# Example GitHub Actions
- run: cd plugins && pnpm install
- run: cd plugins && pnpm check  # Runs format, test, lint, type-check
- run: cd plugins && pnpm build
- run: cd plugins && pnpm build:proxy
```

Turborepo's caching works in CI with remote cache configuration.

## License

UNLICENSED - Update this in `plugins/package.json` for your use case

## Support

For Grafana plugin development:
- [Grafana Plugin Tools](https://grafana.com/developers/plugin-tools/)
- [Grafana Plugin Examples](https://github.com/grafana/grafana-plugin-examples)
- [Grafana Community](https://community.grafana.com/)

## Contributing

This is a template repository. Customize it for your needs and remove this section, or add your own contribution guidelines.
