# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY api/package*.json api/
COPY api/tsconfig.json api/
COPY api/src/ api/src/
RUN npm ci --workspace=api --include-workspace-root
RUN npm run build --workspace=api

# ---- Production stage ----
FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app/api/dist/ ./dist/
COPY --from=build /app/api/node_modules/ ./node_modules/
COPY api/scripts/ ./scripts/
COPY db/ ../db/
COPY api/uploads/ ./uploads/
COPY api/package.json ./

USER appuser
EXPOSE 3001
ENV NODE_ENV=production
CMD ["node", "dist/server.js"]
