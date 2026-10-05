# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY web/package*.json ./web/
RUN npm ci --workspace=web --include-workspace-root --ignore-scripts
COPY web/ ./web/
ARG VITE_DEMO_MODE=false
ENV VITE_DEMO_MODE=$VITE_DEMO_MODE
ARG VITE_DEMO_PREVIEW=false
ENV VITE_DEMO_PREVIEW=$VITE_DEMO_PREVIEW
RUN npm run build --workspace=web

# Stage 2: Serve via Nginx
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY --from=builder /app/web/dist /usr/share/nginx/html
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
