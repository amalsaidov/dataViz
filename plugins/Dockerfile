FROM node:24-alpine

# Use the pnpm version pinned by `packageManager` in package.json, so the image
# never drifts from the workspace (pnpm 11 settings in pnpm-workspace.yaml,
# e.g. allowBuilds, are not understood by older majors).
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app/workspace

# Copy workspace files. .npmrc carries ignore-scripts=true — without it the
# image install would run dependency lifecycle scripts the host install blocks.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY packages ./packages
COPY .shared ./.shared
COPY turbo.json tsconfig.json biome.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

CMD ["pnpm", "dev"]
