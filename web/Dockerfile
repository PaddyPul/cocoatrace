FROM node:20-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY web/package*.json ./
RUN npm ci --production --ignore-scripts

COPY web/ ./
COPY web/public/ ./public/

USER appuser
EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "server.js"]
