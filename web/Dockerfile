# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci --workspace=web --include-workspace-root --ignore-scripts
COPY web/ ./web/
RUN npm run build --workspace=web

# Stage 2: Serve via Nginx
FROM nginx:stable-alpine
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
