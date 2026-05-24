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

**✅ Full-stack deployed at `https://aloeve.club`** behind Cloudflare + nginx (Origin Certificate). The .NET 10 backend runs with JWT auth and Azure Table Storage; the React SPA is wired to it via a dual-mode (mock + real) service layer.

| Area | Status |
|---|---|
| API service layer (`src/services/api/`) | ✅ All domains (auth, users, events, store, blog, forum, matching, chats, songs, images, admin) |
| Authentication | ✅ Email/password + Google Identity Services + Telegram Login Widget + Telegram Mini App (with smart account linking + attach-email + multi-provider sign-in) |
| Tokens | ✅ `access_token` + `refresh_token` in `localStorage`; silent refresh on 401; proactive near-expiry refresh in `ProtectedRoute` |
| Routes | ✅ `<ProtectedRoute>` on content; `<GuestRoute>` on `/`; admin shell at `/admin/*` (second Vite entry) |
| Real-time | ✅ SignalR `/hubs/chat` — private chat + forum reply broadcast |
| Email | ✅ SendGrid (`NullEmailService` console fallback) |
| Image upload | ✅ Profile photos + forum/chat attachments (Azure Blob, 1200px resize, JPEG Q85) |
| Forms | ✅ react-hook-form + Zod on all wired forms (`src/lib/validators.ts`) |
| Error handling | ✅ sonner toasts via `showApiError` (`src/lib/apiError.ts`) |
| Forum | ✅ Sections, topics, replies, topic creation, per-topic event visibility; **event discussions** via `event-discussions/*` |
| Backend persistence | ✅ Azure Table Storage (32 tables, `Lovecraft.Tools.Seeder`) |
| Telegram bot worker | ✅ `Lovecraft.TelegramBot` separate hosted-service container |
| HTTPS | ✅ Cloudflare proxy + Origin Cert on nginx; HTTP→HTTPS redirect |
| Rate limiting | ✅ Sliding window 20 req/min/IP on auth endpoints |
| Roles & ACL | ✅ `appconfig`-driven rank thresholds + permissions; `[RequireStaffRole]` + `[RequirePermission]`; `staffRole` JWT claim |
| Monitoring & metrics | ✅ Admin dashboard at `/admin/metrics` (container status, req volume + latency, DAU/MAU, BI counts); Serilog structured JSON to stdout in all .NET containers; 4 toggleable collection categories; see **[/docs/MONITORING.md](/docs/MONITORING.md)** |

See [/docs/ISSUES.md](/docs/ISSUES.md) for open issues, [/docs/API_INTEGRATION.md](/docs/API_INTEGRATION.md) for the service layer, [/docs/FRONTEND_AUTH_GUIDE.md](/docs/FRONTEND_AUTH_GUIDE.md) for auth integration, [/docs/EVENTS.md](/docs/EVENTS.md) for event behavior, and [/docs/MONITORING.md](/docs/MONITORING.md) for the operator's monitoring guide.

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
- **React Hook Form 7.61.1** - Form state management (login, register, profile edit, forum reply)
- **Zod 3.25.76** - Schema validation (`src/lib/validators.ts`)

### Additional Libraries
- **date-fns 3.6.0** - Date formatting
- **sonner 1.7.4** - Toast notifications (success/error feedback on all API actions; `src/lib/apiError.ts`)
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
│   │   ├── validators.ts   # Zod schemas for all forms
│   │   └── apiError.ts     # showApiError() toast helper
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
- **[FRONTEND_AUTH_GUIDE.md](/docs/FRONTEND_AUTH_GUIDE.md)** - Multi-provider auth (local + Google + Telegram + Mini App)
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

Two modes controlled by `VITE_API_MODE`:

- **`mock`** (default in `.env.development`) — local mock data from `src/data/`. No backend required, but Google/Telegram sign-in unavailable.
- **`api`** (default in `.env.production`) — calls the real LoveCraft backend at `VITE_API_BASE_URL` (empty in production → relative URLs).

All mock data is centralized in `src/data/`. Every domain has a corresponding `src/services/api/[domain]Api.ts` service that dual-routes between the mock data and the real backend based on `isApiMode()`.

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
npm run dev          # Start development server (port 8080)
npm run build        # Build for production
npm run build:dev    # Build in development mode
npm run lint         # Run ESLint
npm run preview      # Preview production build
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once (CI)
npm run test:coverage  # Run tests with coverage report
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
- **Testing**: Vitest + React Testing Library (47 tests across 4 files)

## 🚧 Known Issues

See [/docs/ISSUES.md](/docs/ISSUES.md) for the full list. Active items include:

- 🔴 **PB.4** — no account lockout after failed login attempts
- 🟠 **MCF.1** — desktop navigation (bottom-nav is mobile-only)
- 🟠 **MCF.5** — songs backend endpoint not implemented (frontend `songsApi.ts` always returns mock)
- 🟠 **MCF.6** — pagination on list views
- 🟠 **MCF.17** partial — Telegram Mini App auth shipped; deep-link + command menu + theme polish pending
- 🟡 **TD.1** — loose TypeScript configuration
- 🟡 **TD.7** — token storage in `localStorage` (XSS surface)
- 🟡 **TD.8** — Azure Blob containers public-read; SAS tokens needed

## 🗺️ Roadmap

### Shipped

- ✅ Multi-provider authentication (local + Google Identity Services + Telegram Login Widget + Telegram Mini App)
- ✅ Smart account linking + attach-email flow
- ✅ Azure Table Storage (23 tables) + Azure Blob Storage (profile + content images)
- ✅ Real-time chat via SignalR
- ✅ SendGrid email
- ✅ Rate limiting (20 req/min/IP)
- ✅ HTTPS via Cloudflare Origin Certificate
- ✅ Admin panel scaffold (users, role assignment, rank override, event editor, invites, appconfig view)
- ✅ Roles & ACL system (rank thresholds + permissions in `appconfig`)
- ✅ BB code + image attachments in forum & chat
- ✅ Profile image upload
- ✅ External profile photo download from Google/Telegram CDN
- ✅ Forum topic creation + per-topic event visibility

### Open
- Songs endpoint
- Account lockout
- Notifications + online presence
- SAS tokens for blobs
- Desktop navigation
- Pagination
- Telegram Mini App polish (deep links, command menu)

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
