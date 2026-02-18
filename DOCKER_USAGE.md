# Docker Usage Guide

## Default Behavior

**By default**, Docker builds use **mock mode** (no backend required).

## Mock Mode (Default)

Build and run with mock data:

```bash
# Build
docker build -t aloevera-frontend .

# Run
docker run -p 8080:80 aloevera-frontend

# Access at http://localhost:8080
```

The app will work with local mock data - no backend needed!

## API Mode (When Explicitly Needed)

### Option 1: Override Build Args

```bash
# Build with API mode
docker build \
  --build-arg VITE_API_MODE=api \
  --build-arg VITE_API_BASE_URL=http://localhost:5000 \
  -t aloevera-frontend-api .

# Run
docker run -p 8080:80 aloevera-frontend-api
```

### Option 2: Use Docker Compose (Full Stack)

```bash
# Starts both frontend (API mode) and backend
docker-compose up

# Frontend: http://localhost:8080
# Backend: http://localhost:5000
```

The `docker-compose.yml` is configured for API mode since it includes the backend.

## Build Arguments

| Argument | Default | Description |
|----------|---------|-------------|
| `VITE_API_MODE` | `mock` | Set to `api` for backend integration |
| `VITE_API_BASE_URL` | `http://localhost:5000` | Backend API URL |

## Examples

### Mock Mode (Default - UI Development)
```bash
docker build -t aloevera-frontend .
docker run -p 8080:80 aloevera-frontend
# No backend needed!
```

### API Mode with Local Backend
```bash
docker build \
  --build-arg VITE_API_MODE=api \
  --build-arg VITE_API_BASE_URL=http://host.docker.internal:5000 \
  -t aloevera-frontend .
  
docker run -p 8080:80 aloevera-frontend
# Connects to backend on host machine
```

### API Mode with Production Backend
```bash
docker build \
  --build-arg VITE_API_MODE=api \
  --build-arg VITE_API_BASE_URL=https://api.aloevera-harmony.com \
  -t aloevera-frontend .
  
docker run -p 8080:80 aloevera-frontend
# Connects to production API
```

## Checking Current Mode

Once the container is running, open the browser console at `http://localhost:8080`:

```
🔧 API Mode: mock
🌐 Base URL: http://localhost:5000
```

or

```
🔧 API Mode: api
🌐 Base URL: http://localhost:5000
```

## Tips

1. **Default is Mock Mode** - Just `docker build` and run for UI work
2. **Explicitly Enable API Mode** - Use `--build-arg VITE_API_MODE=api` when needed
3. **Use Docker Compose** - For full stack with both frontend and backend
4. **Check Console** - Browser console shows current mode on page load
