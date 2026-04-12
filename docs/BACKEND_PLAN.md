# Backend Implementation Plan

**AloeVera Harmony Meet** - Backend Development Roadmap

**Last Updated**: March 20, 2026
**Status**: Full-stack deployed on Azure VM at `https://aloeve.club` (HTTPS via Cloudflare + nginx TLS termination). JWT auth, Azure Table Storage, Docker + nginx, token refresh, form validation, and error handling are all implemented. Chat and songs endpoints are pending.

---

## 📋 Overview

This document outlines the backend implementation plan for AloeVera Harmony Meet. The backend will be a **RESTful API** built with **.NET 10** (ASP.NET Core), deployed in **Docker containers** on **Azure**, using **Azure Storage** for data persistence.

### Multi-Client Architecture

The backend is designed to serve multiple client types, **each in its own repository**:
- ✅ **Web Application** (`@aloevera-harmony-meet/`) - React/TypeScript/Vite - Current focus
- 🔜 **Telegram Mini App** (`@aloevera-telegram-bot/` or similar) - JavaScript - Planned, separate repo
- 🔮 **Native Mobile Apps** (`@aloevera-mobile/` or similar) - iOS/Android - Future, separate repo

**Benefits of separate client repositories**:
- Independent deployment and versioning
- Focused CI/CD pipelines
- Different teams can own different clients
- Smaller, more manageable codebases
- Clean git history per client

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Client Applications                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Web App    │  │  Telegram    │  │    Future    │  │
│  │ (React/Vite) │  │   Mini App   │  │  Mobile Apps │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                  │          │
│         └─────────────────┴──────────────────┘          │
└─────────────────────────┬───────────────────────────────┘
                          │ HTTPS/REST
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Backend API (.NET 10 / Docker)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │            REST API Controllers                   │  │
│  │  (User, Auth, Events, Matches, Chats, etc.)      │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │           Business Logic Layer                    │  │
│  │  (Services: UserService, MatchService, etc.)     │  │
│  └──────────────────┬───────────────────────────────┘  │
│                     │                                    │
│  ┌──────────────────▼───────────────────────────────┐  │
│  │           Data Access Layer                       │  │
│  │  (Repositories: Azure Table Storage access)      │  │
│  └──────────────────┬───────────────────────────────┘  │
└────────────────────┬┴────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│                   Azure Storage                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Table     │  │    Blob     │  │   Queue     │     │
│  │  Storage    │  │  Storage    │  │  (Future)   │     │
│  │  (Data)     │  │  (Images)   │  │             │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Scalability Design

- **Horizontal Scaling**: API can scale with multiple container instances
- **Stateless API**: All state stored in Azure Storage
- **Future Enhancements**: 
  - Redis cache for performance
  - Azure Orleans for actor model (user = actor/grain)

---

## 🎯 Technology Stack

### Backend Framework
- **.NET 10** (ASP.NET Core Web API)
- **C#** latest version
- **Minimal APIs** or Controller-based (to be decided)

### Data Storage
- **Azure Table Storage** - Primary data store (NoSQL)
  - Users, Events, Matches, Likes, Messages, Forum data
- **Azure Blob Storage** - File storage
  - Profile images, event images, store product images
- **Azure Queue Storage** - (Future) Background jobs
  - Email notifications, match processing, etc.

### Authentication
- **JWT (JSON Web Tokens)** - Primary auth mechanism
- **Bearer token** authentication
- Designed to support multiple client types:
  - Web app: JWT
  - Telegram: Telegram initData validation (future)
  - Mobile: OAuth/JWT (future)

### Deployment
- **Docker** containers
- **Azure Container Instances** or **Azure App Service**
- **Azure Container Registry** for image storage

### Development Tools
- **Visual Studio 2022** or **VS Code**
- **Docker Desktop** for local development
- **Azurite** (optional) - Azure Storage emulator
- **Postman** / **Swagger** for API testing

---

## 📦 Solution Structure

**Repository**: `@lovecraft/` (separate from frontend)

```
lovecraft/
├── Lovecraft.sln                    # Solution file
├── Lovecraft.Common/                # Shared DTOs and contracts
│   ├── DTOs/
│   │   ├── UserDto.cs
│   │   ├── EventDto.cs
│   │   ├── MatchDto.cs
│   │   └── ...
│   ├── Contracts/
│   │   ├── IUserService.cs
│   │   └── ...
│   └── Models/
│       ├── ApiResponse.cs
│       └── ErrorResponse.cs
├── Lovecraft.Backend/               # Main API project
│   ├── Controllers/
│   │   ├── AuthController.cs
│   │   ├── UsersController.cs
│   │   ├── EventsController.cs
│   │   └── ...
│   ├── Services/
│   │   ├── UserService.cs
│   │   ├── AuthService.cs
│   │   └── ...
│   ├── Repositories/
│   │   ├── UserRepository.cs
│   │   ├── EventRepository.cs
│   │   └── ...
│   ├── Middleware/
│   │   ├── AuthenticationMiddleware.cs
│   │   ├── ErrorHandlingMiddleware.cs
│   │   └── ...
│   ├── Configuration/
│   │   ├── AzureStorageConfig.cs
│   │   └── JwtConfig.cs
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   └── Dockerfile
├── Lovecraft.UnitTests/             # Unit tests
│   ├── Services/
│   ├── Controllers/
│   └── ...
├── docs/                            # Technical documentation
│   ├── API.md                       # API specification
│   ├── ARCHITECTURE.md              # Backend architecture
│   ├── AZURE_STORAGE.md             # Storage schema
│   ├── AUTHENTICATION.md            # Auth design
│   └── DEPLOYMENT.md                # Deployment guide
├── scripts/                         # Utility scripts
│   ├── setup-azure.ps1
│   └── deploy.ps1
└── README.md
```

---

## 🔌 REST API Design

### Base URL
- **Development**: `http://localhost:5000/api`
- **Production**: `https://api.aloevera-meet.com/api`

### API Versioning
- **URL versioning**: `/api/v1/...`
- Allows multiple versions to coexist

### Response Format

**Success Response**:
```json
{
  "success": true,
  "data": { ... },
  "timestamp": "2026-02-17T12:00:00Z"
}
```

**Error Response**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input data",
    "details": { ... }
  },
  "timestamp": "2026-02-17T12:00:00Z"
}
```

### Authentication Header
```
Authorization: Bearer <JWT_TOKEN>
```

### API Endpoints (High-Level)

**Authentication**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT
- `POST /api/v1/auth/refresh` - Refresh JWT token
- `GET /api/v1/auth/me` - Get current user info

**Users**
- `GET /api/v1/users` - Get user list (filtered)
- `GET /api/v1/users/{id}` - Get user details
- `PUT /api/v1/users/{id}` - Update user profile
- `POST /api/v1/users/{id}/images` - Upload profile image
- `DELETE /api/v1/users/{id}/images/{imageId}` - Delete image

**Matches & Likes**
- `POST /api/v1/likes` - Send like
- `DELETE /api/v1/likes/{id}` - Unlike
- `GET /api/v1/likes/sent` - Get sent likes
- `GET /api/v1/likes/received` - Get received likes
- `GET /api/v1/matches` - Get matches
- `DELETE /api/v1/matches/{id}` - Unmatch

**Events**
- `GET /api/v1/events` - Get events list
- `GET /api/v1/events/{id}` - Get event details
- `POST /api/v1/events/{id}/register` - Register for event
- `DELETE /api/v1/events/{id}/register` - Unregister

**Chats & Messages** (Basic REST, real-time later)
- `GET /api/v1/chats` - Get chat list
- `GET /api/v1/chats/{id}` - Get chat details
- `GET /api/v1/chats/{id}/messages` - Get messages
- `POST /api/v1/chats/{id}/messages` - Send message

**Forum**
- `GET /api/v1/forum/sections` - Get forum sections
- `GET /api/v1/forum/sections/{id}/topics` - Get topics
- `POST /api/v1/forum/topics` - Create topic
- `POST /api/v1/forum/topics/{id}/replies` - Reply to topic

**Store** (Read-only, redirects to external site)
- `GET /api/v1/store/items` - Get store items
- `GET /api/v1/store/items/{id}` - Get item details
- Items include external purchase URL

**Blog** (Read-only)
- `GET /api/v1/blog/posts` - Get blog posts
- `GET /api/v1/blog/posts/{id}` - Get post details

**Settings**
- `PUT /api/v1/settings/preferences` - Update preferences
- `PUT /api/v1/settings/privacy` - Update privacy settings

_Detailed API specification: See `@lovecraft/Lovecraft/docs/API.md`_

---

## 🗄️ Azure Storage Schema

### Azure Table Storage

**Tables**:
- `Users` - User profiles and auth data
- `UserImages` - User profile images
- `UserPreferences` - Search preferences
- `UserSettings` - Privacy and app settings
- `Likes` - Like records
- `Matches` - Match records
- `Events` - Event information
- `EventAttendees` - Event registrations
- `Chats` - Chat metadata
- `Messages` - Chat messages
- `ForumSections` - Forum sections
- `ForumTopics` - Forum topics
- `ForumReplies` - Forum replies
- `StoreItems` - Store product catalog
- `BlogPosts` - Blog posts

**Table Design Principles**:
- PartitionKey: Optimized for query patterns
- RowKey: Unique identifier
- No relationships - denormalization preferred
- Query by PartitionKey for best performance

### Azure Blob Storage

**Containers**:
- `profile-images` - User profile photos
- `event-images` - Event photos
- `store-images` - Product images
- `blog-images` - Blog post images

**Naming Convention**: `{userId}/{imageId}.{ext}` or `{entityType}/{entityId}/{imageId}.{ext}`

_Detailed schema: See `@lovecraft/Lovecraft/docs/AZURE_STORAGE.md`_

---

## 🔐 Authentication & Authorization

### JWT Token Structure

**Access Token** (short-lived, 15 minutes):
```json
{
  "sub": "user-id",
  "email": "user@example.com",
  "name": "User Name",
  "role": "user",
  "exp": 1234567890,
  "iat": 1234567800
}
```

**Refresh Token** (long-lived, 7 days):
- Stored securely on client
- Used to obtain new access tokens
- Can be revoked server-side

### Security Measures
- HTTPS only in production
- Password hashing (PBKDF2 + random salt, implemented in `PasswordHasher.cs`)
- Token expiration and refresh mechanism (15 min access / 7 day refresh, rotation on use)
- Rate limiting on sensitive endpoints (planned)
- CORS configuration for allowed origins (localhost:8080, localhost:5173, Azure VM)

### Future: Multi-Client Auth
- Web: JWT
- Telegram: Validate Telegram's `initData` hash, issue JWT
- Mobile: OAuth 2.0 / OIDC (Google, Apple Sign In)

_Detailed auth design: See `@lovecraft/Lovecraft/docs/AUTHENTICATION.md`_

---

## 🐳 Docker Configuration

### Dockerfile (Backend)

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY ["Lovecraft.Backend/Lovecraft.Backend.csproj", "Lovecraft.Backend/"]
COPY ["Lovecraft.Common/Lovecraft.Common.csproj", "Lovecraft.Common/"]
RUN dotnet restore "Lovecraft.Backend/Lovecraft.Backend.csproj"
COPY . .
WORKDIR "/src/Lovecraft.Backend"
RUN dotnet build "Lovecraft.Backend.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "Lovecraft.Backend.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "Lovecraft.Backend.dll"]
```

### docker-compose.yml (Local Development)

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Lovecraft.Backend/Dockerfile
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Development
      - ASPNETCORE_URLS=http://+:80
      - AzureStorage__ConnectionString=${AZURE_STORAGE_CONNECTION_STRING}
      - Jwt__Secret=${JWT_SECRET}
      - Jwt__Issuer=https://localhost:5000
      - Jwt__Audience=https://localhost:8080
    volumes:
      - ./mock-data:/app/mock-data
```

### Environment Variables

```bash
# Azure Storage
AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;EndpointSuffix=core.windows.net
# OR for local development with mock data
AZURE_STORAGE_CONNECTION_STRING=UseDevelopmentStorage=true

# JWT
JWT_SECRET=your-super-secret-key-change-in-production
JWT_ISSUER=https://aloeve.club
JWT_AUDIENCE=https://aloeve.club

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://aloeve.club

# Logging
LOGGING__LOGLEVEL__DEFAULT=Information
```

---

## 📊 Implementation Phases

### Phase 1: Foundation ✅ DONE
**Goal**: Basic project setup and infrastructure

- [x] Create .NET solution structure
- [x] Set up projects: Common, Backend, UnitTests
- [x] Implement basic DTO models (all domains)
- [x] Create Docker configuration
- [x] Set up local development environment
- [ ] Configure Azure Storage connection _(deferred to Phase 3)_

**Deliverables**: Working Docker container, basic project structure ✅

---

### Phase 2: Authentication ✅ DONE (Mock)
**Goal**: User registration and JWT authentication

- [x] Implement User entity and DTOs
- [x] Implement password hashing (PBKDF2 + salt)
- [x] Create JWT token generation/validation (`JwtService.cs`)
- [x] Build AuthController (register, login, logout, refresh, verify-email, forgot-password, reset-password, change-password)
- [x] Add authentication middleware (`[Authorize]` on all controllers)
- [x] 16 unit tests for auth logic
- [x] Frontend: `authApi.ts` service wired to `Welcome.tsx`
- [ ] Create UserRepository (Azure Table Storage) _(deferred)_

**Deliverables**: Working registration and login (mock) ✅

---

### Phase 3: User Management ✅ DONE (Mock)
**Goal**: User profiles and settings

- [x] Implement `MockUserService`
- [x] Build `UsersController` (GET list, GET by ID, PUT)
- [ ] Profile image upload (Azure Blob Storage) _(deferred)_
- [ ] User search/filtering _(basic pagination only)_
- [ ] Settings management _(stub)_

**Deliverables**: Basic user profile API (mock) ✅

---

### Phase 4: Matching System ✅ DONE (Mock)
**Goal**: Likes, matches, and recommendations

- [x] Create Like and Match DTOs
- [x] Implement `MockMatchingService`
- [x] Build `MatchingController` (send like, get sent/received likes, get matches)
- [ ] Implement recommendation algorithm _(deferred)_

**Deliverables**: Working like/match API (mock) ✅

---

### Phase 5: Events ✅ DONE (Mock)
**Goal**: Event management

- [x] Create Event DTOs
- [x] Implement `MockEventService`
- [x] Build `EventsController` (list, get by ID, register, unregister)
- [ ] Event image storage _(deferred)_
- [ ] Event filtering/search _(deferred)_

**Deliverables**: Basic event management API (mock) ✅

---

### Phase 6: Basic Messaging ✅ DONE
**Goal**: REST-based messaging (no real-time yet)

- [x] Create Chat and Message entities (`ChatEntity`, `UserChatEntity`, `MessageEntity`)
- [x] Implement `MockChatService` and `AzureChatService`
- [x] Build `ChatsController` (GET chats, GET messages, POST chat, POST message)
- [x] Message CRUD operations
- [x] Chat list and details
- [x] 13 unit tests for `MockChatService` + 5 hub-path tests

**Deliverables**: ✅ Basic REST messaging + SignalR real-time layer (see Phase 11)

---

### Phase 7: Community Features ✅ DONE (Mock)
**Goal**: Forum and blog

- [x] Create Forum DTOs (Section, Topic, Reply)
- [x] Implement `MockForumService`
- [x] Build `ForumController`
- [x] Create BlogPost DTOs
- [x] Implement `MockBlogService`
- [x] Build `BlogController`

**Deliverables**: Forum and blog APIs (mock) ✅

---

### Phase 8: Store Integration ✅ DONE (Mock)
**Goal**: Store catalog (read-only)

- [x] Create StoreItem DTOs
- [x] Implement `MockStoreService`
- [x] Build `StoreController` (list, get by ID)
- [x] External purchase URL support

**Deliverables**: Store catalog API (mock) ✅

---

### Phase 9: Frontend Integration ✅ DONE
**Goal**: Connect frontend to backend

- [x] CORS configuration (localhost:8080, localhost:5173)
- [x] Swagger/OpenAPI documentation
- [x] Frontend API service layer (`src/services/api/`)
- [x] Auth endpoints connected (login/register working)
- [x] Token storage in `localStorage` via `apiClient` + silent refresh on 401
- [x] Protected routes (`ProtectedRoute` wraps all content routes; proactive near-expiry refresh)
- [x] All pages wired to API services (mock or real depending on `VITE_API_MODE`)
- [x] User-visible error handling via sonner toasts (`showApiError` in `src/lib/apiError.ts`)
- [x] Form validation on all forms (react-hook-form + Zod via `src/lib/validators.ts`)

**Deliverables**: ✅ Working full-stack integration (mock mode + live Azure backend)

---

### Phase 10: Deployment ✅ DONE
**Goal**: Deploy to Azure

- [x] Docker Compose with nginx proxy (ports 80 + 443 exposed; backend internal only)
- [x] Azure VM deployment (`https://aloeve.club`)
- [x] Azure Table Storage integrated (18 tables, seeder tool available)
- [x] Environment variables configured via `.env` file
- [x] nginx proxies `/api/`, `/swagger`, and `/hubs/` to backend container
- [x] SSL/HTTPS — Cloudflare Origin Certificate, Full (strict) mode; HTTP port 80 redirects to HTTPS 443
- [ ] Monitoring and logging — Application Insights not set up
- [ ] Azure Container Registry — using Docker directly on VM

**Deliverables**: ✅ Running on Azure VM at `https://aloeve.club` (HTTPS, Cloudflare proxying, nginx TLS termination)

---

### Phase 11: Real-time Messaging 🔄 Partially Done
**Goal**: Add SignalR for real-time chat

- [x] Add SignalR to backend (`AddSignalR()`, `MapHub<ChatHub>`)
- [x] Implement `ChatHub` (JoinChat, JoinTopic, LeaveGroup, SendMessage)
- [x] JWT query-string token for WebSocket auth (`JwtBearerEvents.OnMessageReceived`)
- [x] Real-time message delivery via `Clients.OthersInGroup`
- [x] Forum reply broadcasting via `IHubContext<ChatHub>` in `ForumController`
- [x] Frontend SignalR integration (`chatConnection.ts` singleton, `useChatSignalR` hook)
- [x] nginx WebSocket proxy config (`/hubs/` location block)
- [x] 18 unit tests for chat service + hub paths
- [ ] Online presence tracking (future)
- [ ] Typing indicators (future)
- [ ] Unread count updates pushed to client (future)

**Deliverables**: ✅ Real-time private chat and forum reply notifications. See [CHAT_ARCHITECTURE.md](../../lovecraft/Lovecraft/docs/CHAT_ARCHITECTURE.md)

---

### Phase 12: Optimization & Scaling (Weeks 17-18)
**Goal**: Performance and scalability

- [ ] Add Redis cache layer
- [ ] Query optimization
- [ ] Image optimization
- [ ] Rate limiting
- [ ] Load testing
- [ ] Monitoring and alerts
- [ ] Documentation updates

**Deliverables**: Production-ready, optimized system

---

## 🚀 Deployment Architecture (Azure)

### Production Setup

```
Internet
   │
   ▼
Azure Front Door (CDN + WAF)
   │
   ├─────────────┬─────────────┐
   │             │             │
   ▼             ▼             ▼
Frontend      Backend API   Backend API
(Static Web   (Container    (Container
App / Blob    Instance 1)   Instance 2)
Storage)           │             │
                   └──────┬──────┘
                          │
                   Load Balancer
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
Azure Table Storage              Azure Blob Storage
(Data)                           (Images)
```

### Azure Resources Needed

- **Resource Group**: `rg-aloevera-meet-prod`
- **Storage Account**: `staloeverameet` (Table + Blob)
- **Container Registry**: `craloeverameet`
- **Container Instances** or **App Service**: Backend API
- **Static Web App**: Frontend (optional, or use Lovable)
- **Front Door**: CDN and WAF
- **Application Insights**: Monitoring
- **Key Vault**: Secrets management

### Estimated Monthly Costs

**Minimal Setup** (Development):
- Storage Account (Standard): ~$5
- Container Instance (1 core, 1GB): ~$15
- Total: **~$20/month**

**Production Setup** (Small Scale):
- Storage Account: ~$20
- Container Instances (2x): ~$30
- Front Door: ~$30
- Application Insights: ~$10
- Key Vault: ~$5
- Total: **~$95/month**

---

## 🧪 Testing Strategy

### Unit Tests
- Service layer (business logic)
- Repository layer (mocked Azure Storage)
- Controllers (mocked services)
- Authentication/authorization logic

### Integration Tests
- API endpoints (in-memory or test Azure Storage)
- Database operations
- Authentication flow

### Manual Testing
- Postman collections for all endpoints
- Frontend integration testing

### Load Testing (Future)
- Apache JMeter or Azure Load Testing
- Concurrent users simulation
- Performance benchmarks

---

## 📚 Documentation

All detailed technical documentation is in `@lovecraft/Lovecraft/docs/`:

- **[API.md](../../lovecraft/Lovecraft/docs/API.md)** - Complete API specification with request/response examples _(to be created)_
- **[ARCHITECTURE.md](../../lovecraft/Lovecraft/docs/ARCHITECTURE.md)** - Detailed backend architecture
- **[AZURE_STORAGE.md](../../lovecraft/Lovecraft/docs/AZURE_STORAGE.md)** - Azure Table Storage schema and patterns
- **[AUTHENTICATION.md](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md)** - ✅ Authentication and authorization design (multi-provider, account linking, JWT)
- **[DEPLOYMENT.md](../../lovecraft/Lovecraft/docs/DEPLOYMENT.md)** - Deployment guide for Azure _(to be created)_
- **[DEVELOPMENT.md](../../lovecraft/Lovecraft/docs/DEVELOPMENT.md)** - Local development setup _(to be created)_

### Client Documentation

Each client has its own repository and documentation:
- **Web App**: `@aloevera-harmony-meet/docs/` (this repository)
- **Telegram Bot**: Separate repo with its own docs (future)
- **Mobile Apps**: Separate repo with its own docs (future)

---

## 🔮 Future Enhancements

### Scalability
- **Azure Orleans**: Actor model with users as grains
- **Redis Cache**: Caching layer for frequently accessed data
- **Azure Service Bus**: Message queue for async processing
- **Azure Functions**: Background jobs (notifications, cleanup)

### Features
- **SignalR**: Real-time chat and notifications
- **Azure Cognitive Services**: Content moderation, image analysis
- **Azure CDN**: Faster content delivery
- **Azure Search**: Advanced search capabilities

### Clients
- **Telegram Mini App**: Telegram bot integration
- **Mobile Apps**: Native iOS/Android apps
- **Desktop Apps**: Electron or .NET MAUI

### Analytics & Monitoring
- **Application Insights**: Advanced monitoring
- **Azure Monitor**: Alerts and dashboards
- **Custom Analytics**: User behavior tracking

---

## ✅ Definition of Done

### Per Phase
- [ ] All features implemented
- [ ] Unit tests written and passing
- [ ] Code documented
- [ ] API endpoints tested (Postman/Swagger)
- [ ] No critical bugs
- [ ] Code reviewed

### Overall Project
- [ ] All phases complete
- [ ] Frontend integration working
- [ ] Deployed to Azure
- [ ] Monitoring configured
- [ ] Documentation complete
- [ ] Performance acceptable
- [ ] Security audit passed

---

## 📞 Communication

### For Web App Developers (React)
- **This repo**: `@aloevera-harmony-meet/`
- API specification: `@lovecraft/Lovecraft/docs/API.md` _(to be created)_
- Swagger UI: `http://localhost:5000/swagger` (when backend is running)
- Questions: Check `@aloevera-harmony-meet/docs/` or `@lovecraft/Lovecraft/docs/`

### For Telegram Bot Developers (Future)
- **Separate repo**: `@aloevera-telegram-bot/` (or similar)
- Will have its own documentation
- Uses same backend API as web app

### For Mobile App Developers (Future)
- **Separate repo**: `@aloevera-mobile/` (or similar)
- Will have its own documentation
- Uses same backend API as web app

### For Backend Developers
- **Main repo**: `@lovecraft/`
- Start here: `@lovecraft/Lovecraft/docs/ARCHITECTURE.md`
- Development setup: `@lovecraft/Lovecraft/docs/DEVELOPMENT.md` _(to be created)_
- Deployment: `@lovecraft/Lovecraft/docs/DEPLOYMENT.md` _(to be created)_

---

**Current Status**: Phases 1–11 are complete or partially complete. The full stack is deployed and operational with real-time chat.

**Remaining Work**:
1. Songs backend endpoint (frontend falls back to mock)
2. Azure Blob Storage for image uploads
3. Email service (SMTP/SendGrid — currently logs to console)
4. OAuth integration (Google, Facebook, VK) — see [AUTHENTICATION.md](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md)
5. Telegram Mini App authentication — planned
6. Rate limiting and account lockout
7. SignalR enhancements: online presence, typing indicators, unread push updates

---

_This document provides a high-level overview. For detailed technical implementation, see the Lovecraft repository documentation._
