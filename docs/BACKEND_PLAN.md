# Backend Implementation Plan

**AloeVera Harmony Meet** - Backend Development Roadmap

**Last Updated**: February 17, 2026  
**Status**: Planning Phase - .NET 10 Backend with Azure Storage

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
- Password hashing (BCrypt or Argon2)
- Token expiration and refresh mechanism
- Rate limiting on sensitive endpoints
- CORS configuration for allowed origins

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
JWT_ISSUER=https://api.aloevera-meet.com
JWT_AUDIENCE=https://aloevera-meet.com

# CORS
ALLOWED_ORIGINS=http://localhost:8080,https://aloevera-meet.com

# Logging
LOGGING__LOGLEVEL__DEFAULT=Information
```

---

## 📊 Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Basic project setup and infrastructure

- [ ] Create .NET solution structure
- [ ] Set up projects: Common, Backend, UnitTests
- [ ] Configure Azure Storage connection
- [ ] Implement basic DTO models
- [ ] Create Docker configuration
- [ ] Set up local development environment

**Deliverables**: Working Docker container, basic project structure

---

### Phase 2: Authentication (Week 3)
**Goal**: User registration and JWT authentication

- [ ] Implement User entity and DTOs
- [ ] Create UserRepository (Azure Table Storage)
- [ ] Implement password hashing
- [ ] Create JWT token generation/validation
- [ ] Build AuthController (`/register`, `/login`, `/refresh`)
- [ ] Add authentication middleware
- [ ] Unit tests for auth logic

**Deliverables**: Working registration and login

---

### Phase 3: User Management (Week 4)
**Goal**: User profiles and settings

- [ ] Implement UserService
- [ ] Build UsersController (GET, PUT)
- [ ] Profile image upload (Azure Blob Storage)
- [ ] User search/filtering
- [ ] Preferences management
- [ ] Settings management
- [ ] Unit tests

**Deliverables**: Full user profile CRUD

---

### Phase 4: Matching System (Weeks 5-6)
**Goal**: Likes, matches, and recommendations

- [ ] Create Like and Match entities
- [ ] Implement LikeRepository and MatchRepository
- [ ] Build MatchingService (like logic, match detection)
- [ ] Create LikesController
- [ ] Create MatchesController
- [ ] Implement basic recommendation algorithm
- [ ] Unit tests

**Deliverables**: Working like/match functionality

---

### Phase 5: Events (Week 7)
**Goal**: Event management

- [ ] Create Event entity
- [ ] Implement EventRepository
- [ ] Build EventsController
- [ ] Event registration/unregistration logic
- [ ] Event image storage
- [ ] Event filtering/search
- [ ] Unit tests

**Deliverables**: Full event management

---

### Phase 6: Basic Messaging (Week 8)
**Goal**: REST-based messaging (no real-time yet)

- [ ] Create Chat and Message entities
- [ ] Implement ChatRepository and MessageRepository
- [ ] Build ChatsController
- [ ] Message CRUD operations
- [ ] Chat list and details
- [ ] Unit tests

**Deliverables**: Basic REST messaging

---

### Phase 7: Community Features (Weeks 9-10)
**Goal**: Forum and blog

- [ ] Create Forum entities (Section, Topic, Reply)
- [ ] Implement ForumRepository
- [ ] Build ForumController
- [ ] Create BlogPost entity
- [ ] Implement BlogRepository
- [ ] Build BlogController
- [ ] Unit tests

**Deliverables**: Forum and blog APIs

---

### Phase 8: Store Integration (Week 11)
**Goal**: Store catalog (read-only)

- [ ] Create StoreItem entity
- [ ] Implement StoreRepository
- [ ] Build StoreController (read-only)
- [ ] External URL configuration
- [ ] Unit tests

**Deliverables**: Store catalog API

---

### Phase 9: Frontend Integration (Weeks 12-13)
**Goal**: Connect frontend to backend

- [ ] CORS configuration
- [ ] API documentation (Swagger)
- [ ] Frontend API service layer
- [ ] Replace mock data with API calls
- [ ] Error handling
- [ ] Loading states
- [ ] Integration testing

**Deliverables**: Working frontend-backend integration

---

### Phase 10: Deployment & Polish (Week 14)
**Goal**: Deploy to Azure

- [ ] Azure Container Registry setup
- [ ] Azure Container Instance/App Service setup
- [ ] Azure Storage account setup
- [ ] Environment variables configuration
- [ ] SSL/HTTPS configuration
- [ ] Monitoring and logging
- [ ] Performance testing

**Deliverables**: Production deployment

---

### Phase 11: Real-time Messaging (Weeks 15-16)
**Goal**: Add SignalR for real-time chat

- [ ] Add SignalR to backend
- [ ] Implement ChatHub
- [ ] Online presence tracking
- [ ] Typing indicators
- [ ] Real-time message delivery
- [ ] Frontend SignalR integration
- [ ] Testing

**Deliverables**: Real-time chat functionality

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
- **[AUTHENTICATION.md](../../lovecraft/Lovecraft/docs/AUTHENTICATION.md)** - Authentication and authorization design _(to be created)_
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

**Next Steps**: 
1. Review this plan
2. Create .NET solution in `@lovecraft/`
3. Start with Phase 1 (Foundation)
4. Detailed technical docs in `@lovecraft/Lovecraft/docs/`

---

_This document provides a high-level overview. For detailed technical implementation, see the Lovecraft repository documentation._
