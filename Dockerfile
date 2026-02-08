### Stage 1: Dependencies
FROM oven/bun:1 AS deps
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/backend/package.json packages/backend/
COPY packages/frontend/package.json packages/frontend/
RUN bun install --frozen-lockfile || bun install

### Stage 2: Build
FROM oven/bun:1 AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=deps /app/packages/frontend/node_modules ./packages/frontend/node_modules
COPY . .
RUN bun run --filter '*' build

### Stage 3: Runtime
FROM oven/bun:1-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy backend build + dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY --from=build /app/packages/backend/dist ./packages/backend/dist
COPY --from=build /app/packages/backend/package.json ./packages/backend/

# Copy shared (needed at runtime since backend imports it)
COPY --from=build /app/packages/shared/src ./packages/shared/src
COPY --from=build /app/packages/shared/package.json ./packages/shared/

# Copy frontend build (served as static files)
COPY --from=build /app/packages/frontend/dist ./packages/frontend/dist

EXPOSE 3001
CMD ["bun", "packages/backend/dist/index.js"]
