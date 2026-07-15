FROM node:22-alpine

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app/workspace

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages ./packages
COPY .shared ./.shared
COPY turbo.json tsconfig.json biome.json ./
COPY vitest.config.base.mts vitest.setup.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile

CMD ["pnpm", "dev"]
