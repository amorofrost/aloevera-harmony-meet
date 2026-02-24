# AloeVera Harmony Meet 🎵💕

A mock web application for AloeVera music band fans to connect, communicate, and engage with the band's ecosystem.

[![Lovable Project](https://img.shields.io/badge/Built_with-Lovable-ff69b4)](https://lovable.dev/projects/01533d16-e873-4486-a75c-9898c6237499)

## 📖 Overview

AloeVera Harmony Meet is a comprehensive fan community platform that combines dating features with social networking, specifically designed for AloeVera music band enthusiasts. The platform helps fans:

- 🔍 **Find Friends & Dates** - Swipe-based matching system with music preferences
- 💬 **Community Forums** - Topic-based discussions (General, Music, Cities, Offtopic)
- 📅 **Event Management** - Concert signups, festival registrations, fan meetups, and exclusive events
- 📝 **Band Blog** - Latest news and behind-the-scenes content
- 🛍️ **Merch Store** - Official band merchandise
- 🎵 **Music Integration** - Favorite songs, album preferences, event attendance tracking

## 🎯 Current Status

**✅ Full-stack deployed on Azure VM.** The backend (.NET 10) runs with JWT authentication and Azure Table Storage. All frontend pages are wired to the backend via a dual-mode API service layer. The full stack runs in Docker behind an nginx proxy on a single port.

| Area | Status |
|------|--------|
| API service layer (`src/services/api/`) | ✅ Implemented (all domains) |
| Auth endpoints (login/register) | ✅ Connected to backend |
| Token storage (`localStorage`) | ✅ Both `access_token` and `refresh_token` stored |
| Protected routes (`ProtectedRoute`) | ✅ All content routes guarded; proactive refresh on near-expiry |
| Friends / matching pages | ✅ Wired to `matchingApi` / `chatsApi` |
| Events / Store / Blog pages | ✅ Wired to `eventsApi` / `storeApi` / `blogApi` |
| Talks / Forum pages | ✅ Wired (sections, topic list, topic detail, reply posting) |
| Forum topic detail view | ✅ `TopicDetail` component with author navigation |
| Mock data centralized | ✅ All in `src/data/` |
| Backend data persistence | ✅ Azure Table Storage integrated (`USE_AZURE_STORAGE=true`) |
| Seed tool | ✅ `Lovecraft.Tools.Seeder` — seeds all tables from mock data |
| Docker deployment | ✅ nginx proxy on port 8080 (no need to expose port 5000) |
| Token refresh | ✅ Silent refresh in `apiClient`; proactive refresh in `ProtectedRoute` |

See [/docs/ISSUES.md](/docs/ISSUES.md) for detailed issues and [/docs/API_INTEGRATION.md](/docs/API_INTEGRATION.md) for integration guide.

## 🚀 Quick Start

### Prerequisites

- Node.js (v18+ recommended) - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
- npm or bun package manager

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd aloevera-harmony-meet

# Install dependencies
npm install
# or
bun install

# Start development server
npm run dev
# or
bun run dev
```

The application will be available at `http://localhost:8080`

## 🛠️ Technology Stack

### Core Framework
- **React 18.3.1** - Frontend framework
- **TypeScript 5.8.3** - Type safety
- **Vite 5.4.19** - Build tool and dev server

### UI & Styling
- **shadcn/ui** - Component library (Radix UI primitives)
- **Tailwind CSS 3.4.17** - Utility-first CSS framework
- **Lucide React** - Icon library
- **Custom Design System** - AloeVera brand colors and themes

### Routing & State
- **React Router DOM 6.30.1** - Client-side routing
- **TanStack React Query 5.83.0** - Data fetching (configured but minimal usage)
- **React Context API** - Language/i18n management

### Form & Validation
- **React Hook Form 7.61.1** - Form state management
- **Zod 3.25.76** - Schema validation

### Additional Libraries
- **date-fns 3.6.0** - Date formatting
- **sonner 1.7.4** - Toast notifications
- **recharts 2.15.4** - Charts (for future analytics)
- **embla-carousel-react** - Carousels

## 📁 Project Structure

```
aloevera-harmony-meet/
├── src/
│   ├── pages/              # Page components
│   │   ├── Welcome.tsx     # Landing/authentication
│   │   ├── Friends.tsx     # Dating features (search, likes, chats)
│   │   ├── Talks.tsx       # Forums & event group chats
│   │   ├── AloeVera.tsx    # Band hub (events, store, blog)
│   │   ├── EventDetails.tsx
│   │   ├── BlogPost.tsx
│   │   ├── StoreItem.tsx
│   │   ├── SettingsPage.tsx
│   │   └── NotFound.tsx
│   ├── components/
│   │   └── ui/             # shadcn/ui components (60+ files)
│   ├── contexts/
│   │   └── LanguageContext.tsx  # i18n (ru/en)
│   ├── types/
│   │   ├── user.ts         # User, Event, Match, Like types
│   │   └── chat.ts         # Chat, Message types
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utilities
│   ├── assets/             # Images
│   ├── App.tsx             # Main app with routing
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles & design system
├── docs/                   # Documentation (see below)
├── public/                 # Static assets
└── [config files]          # vite, tsconfig, tailwind, etc.
```

## 📚 Documentation

Detailed documentation is available in the `/docs` directory:

- **[ARCHITECTURE.md](/docs/ARCHITECTURE.md)** - Technical architecture and design decisions
- **[API_INTEGRATION.md](/docs/API_INTEGRATION.md)** - API service layer guide (mock vs real backend)
- **[FRONTEND_AUTH_GUIDE.md](/docs/FRONTEND_AUTH_GUIDE.md)** - Auth integration guide for developers
- **[ISSUES.md](/docs/ISSUES.md)** - Known issues and technical debt
- **[FEATURES.md](/docs/FEATURES.md)** - Detailed feature specifications
- **[BACKEND_PLAN.md](/docs/BACKEND_PLAN.md)** - Backend implementation roadmap
- **[AGENTS.md](/AGENTS.md)** - Instructions for AI agents working on this project

## 🎨 Features

### 🔐 Authentication (Mock)
- Login/Register forms
- Profile creation with age, gender, location, bio

### 💑 Dating Features (`/friends`)
- **Search Tab**: Swipeable profile cards with Tinder-like UX
- **Likes Tab**: Matches, sent likes, received likes
- **Chats Tab**: Private messaging with matched users
- Profile details with events attended and favorite songs

### 🗣️ Community Features (`/talks`)
- Forum sections with topics and replies
- Event-based group chats
- Real-time-style messaging interface

### 🎸 Band Hub (`/aloevera`)
- **Events**: Concerts, festivals, meetups, parties, yachting trips
- **Store**: Merchandise with categories
- **Blog**: Band news, interviews, tour updates

### ⚙️ Settings (`/settings`)
- Profile editing
- Privacy settings
- Language switching (Russian/English)
- Notification preferences

## 🌐 Internationalization

The app supports Russian (ru) and English (en) via `LanguageContext`. Translation keys are defined in `src/contexts/LanguageContext.tsx`.

## 🎭 Mock Data & API Integration

The app operates in two modes controlled by `VITE_API_MODE`:

- **`mock` (default/dev)**: Uses local mock data. No backend required.
- **`api`**: Calls the real LoveCraft backend at `VITE_API_BASE_URL`.

**Centralized mock data** (partially done):
- `src/data/mockUsers.ts` - Auth mock users

**Still embedded in page components** (to be migrated):
- **Users**: `Friends.tsx`, `EventDetails.tsx`, `SettingsPage.tsx`
- **Events**: `AloeVera.tsx`, `EventDetails.tsx`
- **Store Items**: `AloeVera.tsx`, `StoreItem.tsx`
- **Blog Posts**: `AloeVera.tsx`, `BlogPost.tsx`
- **Forum Topics**: `Talks.tsx`
- **Chats/Messages**: `Friends.tsx`, `Talks.tsx`

## 🐳 Docker Support

The project includes Docker configuration:

```bash
# Development
docker-compose -f docker-compose.dev.yml up

# Production
docker-compose up
```

## 📋 Available Scripts

```bash
npm run dev         # Start development server (port 8080)
npm run build       # Build for production
npm run build:dev   # Build in development mode
npm run lint        # Run ESLint
npm run preview     # Preview production build
```

## 🔧 Development

### Lovable Integration

This project was initially created with [Lovable](https://lovable.dev). Changes can be made via:

1. **Lovable Platform**: [Project Dashboard](https://lovable.dev/projects/01533d16-e873-4486-a75c-9898c6237499)
2. **Local IDE**: Clone and push changes
3. **GitHub Direct Edit**: Edit files in browser
4. **GitHub Codespaces**: Full cloud development environment

Changes made via Lovable are automatically committed to the repository.

### Code Quality

- **TypeScript**: Loose settings (see ISSUES.md) - consider tightening
- **ESLint**: Configured with React hooks and TypeScript rules
- **No Testing**: Currently no test framework setup

## 🚧 Known Issues

See [/docs/ISSUES.md](/docs/ISSUES.md) for a comprehensive list. Major issues include:

- ✅ Backend exists in `@lovecraft/` (.NET 10 with JWT auth)
- ✅ Auth endpoints wired to backend API
- ⚠️ AuthContext / token storage not implemented — access token is not persisted
- ⚠️ No protected routes — pages accessible without login
- ⚠️ Friends, Talks, AloeVera pages still use embedded mock data
- ⚠️ Loose TypeScript configuration
- ⚠️ No testing setup
- ⚠️ Type inconsistencies (duplicate Message interface)

## 🗺️ Roadmap

### Backend — `@lovecraft/` (Working Mock)

The backend is running with in-memory mock data:
- ✅ **.NET 10** REST API with all controllers
- ✅ **JWT** authentication (login, register, refresh, email verify)
- ✅ **Docker** containerization
- ✅ **Swagger UI** at `/swagger`
- ⚠️ **Azure Storage** — not yet integrated (still in-memory)
- ⚠️ **Email service** — not yet integrated (tokens logged to console)

See [/docs/BACKEND_PLAN.md](/docs/BACKEND_PLAN.md) for the full roadmap.

### Frontend Integration — Immediate Next Steps

1. **AuthContext** — store access token in React Context, implement auto-refresh
2. **Protected routes** — redirect unauthenticated users to `/`
3. **Wire remaining pages** — create `eventsApi`, `matchingApi`, `forumsApi`, `storeApi`, `blogApi`
4. **Replace embedded mock data** — Friends, AloeVera, Talks pages
5. **Loading & error states** — for all async data fetches

### Future Clients
- Telegram Mini App (JavaScript)
- Native mobile apps (iOS/Android)

## 🤝 Contributing

When working on this project:

1. Read [AGENTS.md](/AGENTS.md) for project conventions
2. Review [/docs/ARCHITECTURE.md](/docs/ARCHITECTURE.md) for technical context
3. Check [/docs/ISSUES.md](/docs/ISSUES.md) for known problems
4. Follow existing code patterns and design system

## 📄 License

- **[MIT LICENSE](/LICENSE)** 

## 🔗 Links

- **Frontend (this repo)**: React/TypeScript web application
- **Backend**: `@lovecraft/` - .NET 10 API (separate repository)
- **Lovable Project**: https://lovable.dev/projects/01533d16-e873-4486-a75c-9898c6237499
- **Documentation**: See `/docs` folder
- **Backend Docs**: See `@lovecraft/Lovecraft/docs/`
- **Issues**: See `/docs/ISSUES.md`

---

Built with ❤️ for AloeVera fans
