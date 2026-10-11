# Multi-stage Production Dockerfile for Home Care Backend API (@homecare/api)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace root manifests
COPY package.json package-lock.json tsconfig.base.json ./

# Copy shared workspace packages & API manifests
COPY packages ./packages
COPY apps/api ./apps/api
COPY db ./db
COPY scripts ./scripts

# Install dependencies and build contracts + API
RUN npm ci
RUN npm --prefix packages/contracts run build || true
RUN npm --prefix apps/api run build

# Production Runner Stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/db ./db
COPY --from=builder /app/scripts ./scripts

EXPOSE 3000

# Run forward-only database migrations on startup, then launch the NestJS API server
CMD ["sh", "-c", "node scripts/migrate.mjs && node apps/api/dist/main.js"]
