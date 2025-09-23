# 🐳 Docker Deployment Guide for AloeVera Harmony Meet

This guide explains how to run your dating web app using Docker containers for both development and production environments.

## 📋 Prerequisites

- **Docker** (version 20.0 or higher)
- **Docker Compose** (version 2.0 or higher)
- **Git** (to clone the repository)

### Install Docker

**Ubuntu/Debian:**
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

**macOS:**
Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)

**Windows:**
Download Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop)

## 🚀 Quick Start

### Option 1: Production Build (Recommended for deployment)

```bash
# Clone the repository
git clone <your-repo-url>
cd aloevera-harmony-meet

# Build and run the application
docker-compose up --build -d

# Access the app at http://localhost:3000
```

### Option 2: Development Build (For active development)

```bash
# Clone the repository
git clone <your-repo-url>
cd aloevera-harmony-meet

# Run development environment with hot reload
docker-compose -f docker-compose.dev.yml up --build

# Access the app at http://localhost:5173
```

## 📁 Docker Files Overview

### `Dockerfile` (Production)
- **Multi-stage build** for optimized production image
- **Stage 1:** Builds the React app using Node.js
- **Stage 2:** Serves the built app using Nginx
- **Final size:** ~50MB (much smaller than development)
- **Features:** Gzip compression, caching, security headers

### `Dockerfile.dev` (Development)
- Single-stage build for development
- Includes hot reload functionality
- Mounts source code as volume for live changes
- Larger size but faster development workflow

### `docker-compose.yml` (Production)
Simple frontend-only setup including:
- **Main frontend container** (port 3000)
- **Nginx web server** with optimized React SPA serving
- **API proxy configuration** for backend microservice communication
- **CORS support** for cross-origin requests

### `docker-compose.dev.yml` (Development)
Simplified development setup with:
- Hot reload enabled
- Volume mounting for live code changes
- Development dependencies included

## 🛠 Detailed Commands

### Production Deployment

```bash
# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f aloevera-harmony-meet

# Stop all services
docker-compose down

# Stop and remove volumes (careful: deletes database data)
docker-compose down -v

# Rebuild only the app (after code changes)
docker-compose build aloevera-harmony-meet
docker-compose up -d aloevera-harmony-meet
```

### Development Workflow

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up

# Run in background
docker-compose -f docker-compose.dev.yml up -d

# View development logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Database Operations (Backend Microservice)

Since this frontend connects to a separate backend microservice, database operations are handled by your backend service. The frontend communicates via API calls:

```bash
# Configure backend API URL
export VITE_API_URL=http://your-backend-service:8080

# Or set in .env file
echo "VITE_API_URL=http://your-backend-service:8080" > .env
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the project root for custom configuration:

```env
# App Configuration
NODE_ENV=production
VITE_APP_NAME=AloeVera Harmony Meet
VITE_API_URL=http://your-backend-microservice:8080

# Frontend-specific settings
VITE_APP_VERSION=1.0.0
VITE_ENABLE_ANALYTICS=true
```

### Nginx Configuration

The included `nginx.conf` provides:
- **SPA routing support** (for React Router)
- **Static asset caching** (1 year cache for images/JS/CSS)
- **Gzip compression** (reduces bandwidth)
- **Security headers** (XSS protection, content type sniffing)
- **API proxy setup** (ready for backend integration)

## 🏗 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Frontend     │    │   Backend API   │    │   Database +    │
│   (Port 3000)   │───▶│  Microservice   │───▶│     Cache       │
│   React +       │    │   (Port 8080)   │    │  (Separate      │
│   TypeScript    │    │                 │    │   Service)      │
│   + Nginx       │    │  Your separate  │    │                 │
└─────────────────┘    │   backend       │    └─────────────────┘
                       └─────────────────┘
```

**Frontend Container (This Project):**
- React/TypeScript SPA
- Nginx web server
- API proxy to backend
- Static asset serving

**Backend Microservice (Your Separate Service):**
- API endpoints
- Business logic
- Database operations
- Authentication
- File uploads

## 🔒 Security Considerations

### Production Security
1. **Change default passwords** in `docker-compose.yml`
2. **Use environment variables** for sensitive data
3. **Enable SSL/TLS** with Let's Encrypt or custom certificates
4. **Restrict network access** using Docker networks
5. **Regular updates** of base images

### SSL/HTTPS Setup (Production)
```bash
# Create SSL directory
mkdir ssl

# Generate self-signed certificate (for testing)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/nginx.key -out ssl/nginx.crt

# For production, use Let's Encrypt:
# certbot --nginx -d yourdomain.com
```

## 📊 Monitoring & Logs

### View Logs
```bash
# All services
docker-compose logs

# Specific service
docker-compose logs aloevera-harmony-meet

# Follow logs in real-time
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100
```

### Health Checks
```bash
# Check container health
docker ps

# Test health endpoint
curl http://localhost:3000/health

# Container stats
docker stats
```

## 🚀 Deployment to Cloud

### AWS ECS
```bash
# Build for ARM64 (for AWS Graviton)
docker buildx build --platform linux/arm64 -t your-app .
```

### Google Cloud Run
```bash
# Build and push to Google Container Registry
docker build -t gcr.io/your-project/aloevera-dating .
docker push gcr.io/your-project/aloevera-dating
```

### DigitalOcean Droplet
```bash
# Use docker-compose directly on the droplet
scp docker-compose.yml root@your-droplet-ip:/root/
ssh root@your-droplet-ip "cd /root && docker-compose up -d"
```

## 🔧 Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find what's using the port
sudo lsof -i :3000
# Kill the process or change the port in docker-compose.yml
```

**Permission denied (Linux):**
```bash
# Add user to docker group
sudo usermod -aG docker $USER
# Logout and login again
```

**Container won't start:**
```bash
# Check logs
docker-compose logs aloevera-harmony-meet
# Check if image built successfully
docker images
```

**Database connection issues:**
```bash
# Check if backend microservice is accessible
curl http://your-backend-url:8080/health
# Check API proxy configuration in nginx.conf
docker-compose logs aloevera-harmony-meet
```

## 📈 Performance Optimization

### Production Optimizations
- Multi-stage Docker build reduces image size by ~80%
- Nginx gzip compression reduces bandwidth usage
- Static asset caching improves load times
- Health checks ensure service reliability

### Scaling
```bash
# Scale the web app to 3 instances
docker-compose up --scale aloevera-harmony-meet=3

# Use with load balancer for high availability
```

## 🎯 Next Steps

1. **Connect to backend microservice** - Configure VITE_API_URL to point to your backend
2. **Authentication integration** - Implement login/logout with your backend auth system
3. **API client setup** - Create TypeScript interfaces for your backend API
4. **Error handling** - Implement proper error boundaries for API failures
5. **File uploads** - Handle profile photos through your backend service
6. **Real-time features** - WebSocket integration with your backend
7. **Push notifications** - Mobile notifications through your backend
8. **CI/CD pipeline** - Automated testing and deployment

This Docker setup provides a clean, focused frontend container that works perfectly with your microservice architecture! 🚀