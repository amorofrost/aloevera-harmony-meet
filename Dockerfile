# Multi-stage build for production optimization
FROM node:18-alpine as builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build arguments for environment configuration
# Default to mock mode (no backend required)
ARG VITE_API_MODE=mock
ARG VITE_API_BASE_URL=

# Set environment variables for build
ENV VITE_API_MODE=$VITE_API_MODE
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Lightweight container-side infrastructure metrics (no Docker APIs).
COPY infra/infra.sh /usr/local/bin/infra.sh
RUN chmod +x /usr/local/bin/infra.sh

# Expose HTTP and HTTPS ports
EXPOSE 80
EXPOSE 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start infra writer loop + nginx
CMD ["/bin/sh", "-c", "(/usr/local/bin/infra.sh; while true; do sleep 5; /usr/local/bin/infra.sh; done) & nginx -g 'daemon off;'"]