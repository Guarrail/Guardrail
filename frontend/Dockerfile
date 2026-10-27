# Stage 1: Build the React application
FROM node:22-alpine AS builder

WORKDIR /app

# Accept build arguments from Docker Compose
ARG VITE_API_BASE_URL
ARG VITE_FRONTEND_URL
ARG VITE_VPS_IP

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_FRONTEND_URL=${VITE_FRONTEND_URL}
ENV VITE_VPS_IP=${VITE_VPS_IP}

# Copy dependency manifests
COPY package.json package-lock.json ./

# Install dependencies including peer dependencies
RUN npm ci --legacy-peer-deps

# Copy source code and configuration files
COPY . .

# Build production bundle using Vite
RUN npm run build

# Stage 2: Serve with lightweight Nginx
FROM nginx:alpine AS production

# Copy custom nginx configuration with SPA routing and API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy compiled assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 3000

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
