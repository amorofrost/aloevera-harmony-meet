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

**⚠️ Frontend-only with MOCK data.** The backend is being developed separately in the **LoveCraft** repository (`@lovecraft/`). All features currently use static mock data defined in components. See [/docs/ISSUES.md](/docs/ISSUES.md) for identified issues and [/docs/BACKEND_PLAN.md](/docs/BACKEND_PLAN.md) for backend roadmap.

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

## 🎭 Mock Data

All data is currently hardcoded within page components:

- **Users**: Defined in `Friends.tsx`, `EventDetails.tsx`, `SettingsPage.tsx`
- **Events**: Defined in `AloeVera.tsx`, `EventDetails.tsx`
- **Store Items**: Defined in `AloeVera.tsx`, `StoreItem.tsx`
- **Blog Posts**: Defined in `AloeVera.tsx`, `BlogPost.tsx`
- **Forum Topics**: Defined in `Talks.tsx`
- **Chats/Messages**: Defined in `Friends.tsx`, `Talks.tsx`

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

- ⚠️ **Backend in separate repo** - See `@lovecraft/` for .NET 10 backend
- ⚠️ Frontend uses mock data (no API integration yet)
- ⚠️ Loose TypeScript configuration
- ⚠️ No testing setup
- ⚠️ Mock data embedded in components (should be centralized)
- ⚠️ No authentication/authorization (frontend-only)
- ⚠️ No data persistence
- ⚠️ Type inconsistencies (duplicate Message interface)

## 🗺️ Roadmap

### Backend Development (In Progress)

Backend is being developed in **`@lovecraft/`** repository:
- **.NET 10** REST API
- **Azure Storage** (Tables + Blobs)
- **Docker** containerization
- **JWT** authentication

See [/docs/BACKEND_PLAN.md](/docs/BACKEND_PLAN.md) for 12-phase implementation plan.

### Frontend Integration
- Connect to backend API
- Replace mock data with real API calls
- Add loading states and error handling
- Real-time messaging (SignalR)

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

[Your license here]

## 🔗 Links

- **Frontend (this repo)**: React/TypeScript web application
- **Backend**: `@lovecraft/` - .NET 10 API (separate repository)
- **Lovable Project**: https://lovable.dev/projects/01533d16-e873-4486-a75c-9898c6237499
- **Documentation**: See `/docs` folder
- **Backend Docs**: See `@lovecraft/Lovecraft/docs/`
- **Issues**: See `/docs/ISSUES.md`

---

Built with ❤️ for AloeVera fans
