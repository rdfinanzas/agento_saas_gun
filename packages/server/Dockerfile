# ===========================================
# AgenTo Server - Dockerfile for Bun
# ===========================================

FROM oven/bun:1.2-alpine AS base

# Install dependencies only (for caching)
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Build stage
FROM base AS builder
WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

# Production image
FROM base AS runner
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Set production environment
ENV NODE_ENV=production
ENV PORT=3001

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 agento

# Create directories with proper permissions
RUN mkdir -p /app/workspaces /app/storage && chown agento:nodejs /app/workspaces /app/storage

# Copy source files, config, and dependencies
COPY --from=builder --chown=agento:nodejs /app/src ./src
COPY --from=builder --chown=agento:nodejs /app/scripts ./scripts
COPY --from=builder --chown=agento:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=agento:nodejs /app/tsconfig.json ./
COPY --from=builder --chown=agento:nodejs /app/package.json ./
COPY --from=deps --chown=agento:nodejs /app/node_modules ./node_modules

USER agento

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5   CMD curl -f http://localhost:3001/health || exit 1

# Start the server
CMD ["bun", "run", "scripts/start-all.ts"]
