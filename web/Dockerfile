FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy root lockfile + web package.json for workspace resolution
COPY package*.json ./
COPY web/package*.json ./web/

RUN npm ci --workspace=web --include-workspace-root --ignore-scripts

COPY web/ ./

USER appuser
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
