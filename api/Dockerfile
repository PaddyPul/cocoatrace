# Build tooling stays in this stage.
FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY api/package*.json ./api/
COPY api/tsconfig.json ./api/
RUN npm ci --workspace=api --include-workspace-root --ignore-scripts
COPY api/src/ ./api/src/
RUN npm run build --workspace=api

FROM node:24-alpine AS runtime
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY package*.json ./
COPY api/package*.json ./api/
# tsx is an explicit runtime dependency for reviewed maintenance/migration CLIs.
# Root lint tools and workspace development dependencies are excluded.
RUN npm ci --workspace=api --omit=dev --include-workspace-root=false --ignore-scripts \
  && rm -f package-lock.json
COPY --from=build /app/api/dist ./api/dist
COPY api/src/ ./api/src/
COPY api/tsconfig.json ./api/
COPY api/knexfile.ts ./api/
COPY api/migrations.manifest.json ./api/
COPY api/scripts/ ./api/scripts/
COPY db/ ./db/
RUN find api/src -type f -name '*.test.ts' -delete \
  && find api/dist -type f \( -name '*.test.*' -o -name '*.map' -o -name '*.d.ts' \) -delete \
  && mkdir -p /app/private-evidence \
  && chown appuser:appgroup /app/private-evidence
USER appuser
EXPOSE 3001
ENV NODE_ENV=production
# Retain original TypeScript migration names and enforce manifest integrity.
# No npx download is allowed or needed on the normal startup path.
CMD ["sh", "-c", "node --import tsx api/scripts/migrate.ts && exec node api/dist/server.js"]
