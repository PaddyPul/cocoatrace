FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy root workspace config first (for npm workspaces resolution)
COPY package*.json ./
COPY api/package*.json ./api/
COPY api/tsconfig.json ./api/

# Install all workspace deps (hoisted to root node_modules)
RUN npm ci --workspace=api --include-workspace-root --ignore-scripts \
  && npm rebuild bcryptjs

# Copy source and build
COPY api/src/ ./api/src/
RUN npm run build --workspace=api && rm -f api/dist/migrations/*.d.ts

# Copy runtime assets, knexfile, db scripts, and migration/seed scripts
COPY api/uploads/ ./api/uploads/
COPY api/knexfile.ts ./api/
COPY db/ ./db/
COPY api/scripts/ ./api/scripts/

USER appuser
EXPOSE 3001
ENV NODE_ENV=production

# Auto-apply schema + seed on container start, then run app
CMD npx tsx api/scripts/migrate.ts && npx tsx api/scripts/seed.ts && node api/dist/server.js
