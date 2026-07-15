FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@10

# Install Go for backend builds
RUN apk add --no-cache go git make

# Set Go environment first
ENV GOPATH=/go
ENV PATH=$PATH:$GOPATH/bin

# Install Mage for Go builds (now that PATH is set)
RUN go install github.com/magefile/mage@latest

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
