# AI Agent Instructions

**AloeVera Harmony Meet** - Guidelines for AI Assistants

This document provides context and instructions for AI coding assistants (like Cursor, GitHub Copilot, etc.) working on this project.

---

## 🎯 Project Overview

**AloeVera Harmony Meet** is a fan community platform for AloeVera music band enthusiasts that combines dating features, social networking, event management, and e-commerce.

**Current State**: Frontend-only React application with mock data. No backend exists yet.

**Tech Stack**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, React Router DOM

---

## 📁 Project Structure

```
aloevera-harmony-meet/
├── src/
│   ├── pages/              # Page components (main routes)
│   ├── components/ui/      # Reusable UI components (shadcn/ui + custom)
│   ├── contexts/           # React Context providers (LanguageContext)
│   ├── types/              # TypeScript type definitions
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # Utility functions
│   ├── assets/             # Images and static assets
│   ├── App.tsx             # Main app with routing
│   ├── main.tsx            # Entry point
│   └── index.css           # Global styles + design system
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md     # Technical architecture
│   ├── ISSUES.md           # Known issues and technical debt
│   ├── FEATURES.md         # Feature specifications
│   └── BACKEND_PLAN.md     # Backend implementation roadmap
├── public/                 # Static public assets
├── [config files]          # vite.config.ts, tsconfig.json, tailwind.config.ts, etc.
└── AGENTS.md              # This file
```

---

## 🎨 Design System & Styling

### Colors (HSL Format)

**AloeVera Brand Colors**:
```css
--aloe-gold: 45 96% 53%        /* Primary yellow-gold */
--aloe-flame: 14 91% 60%       /* Primary orange-red */
--aloe-ocean: 204 64% 44%      /* Blue accent */
--aloe-coral: 343 87% 70%      /* Pink accent */
--aloe-lavender: 259 34% 62%   /* Purple accent */
--aloe-sage: 159 25% 52%       /* Green accent */
```

**Semantic Colors**:
```css
--primary: var(--aloe-flame)       /* Use for primary actions */
--secondary: var(--aloe-gold)      /* Use for secondary actions */
--accent: var(--aloe-coral)        /* Use for highlights */
```

### Custom CSS Classes

**Use these instead of inline Tailwind when applicable**:
```css
.btn-like       /* Like button (coral → flame gradient) */
.btn-pass       /* Pass button (gray gradient) */
.btn-match      /* Match button (gold gradient) */
.profile-card   /* Card with gradient background + shadow */
.swipe-card     /* Touch-enabled swipeable card */
.nav-active     /* Active navigation state with glow */
```

### Styling Guidelines

1. **Use Tailwind utilities** for layout and basic styling
2. **Use semantic color variables** instead of hardcoded colors
3. **Use custom classes** for complex, reusable patterns
4. **Follow mobile-first** responsive design
5. **Maintain consistent spacing** (4px base unit: p-1, p-2, p-4, p-6, p-8, p-12)

---

## 🧩 Component Patterns

### Page Components

**Location**: `src/pages/`

**Structure**:
```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import BottomNavigation from '@/components/ui/bottom-navigation';
import { Type1, Type2 } from '@/types/user';

const PageName = () => {
  const [state, setState] = useState(initialValue);
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Mock data (until backend implemented)
  const mockData = [...];

  // Event handlers
  const handleAction = () => { /* ... */ };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Background */}
      <div className="fixed inset-0 bg-cover bg-center bg-no-repeat opacity-80" 
           style={{ backgroundImage: `url(${heroBg})` }}>
        <div className="absolute inset-0 bg-background/90"></div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b">
        {/* Header content */}
      </div>

      {/* Content */}
      <div className="p-4 relative z-10">
        {/* Page content */}
      </div>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
};

export default PageName;
```

**Guidelines**:
- Always include `BottomNavigation` at the end
- Use `pb-20` on main container to account for bottom nav
- Use backdrop blur for headers (`backdrop-blur-md`)
- Use relative z-index for layering (background: 0, content: 10, header: 40, nav: 50)
- Import translation function: `const { t } = useLanguage()`
- Use mock data until backend is implemented

---

### UI Components

**Location**: `src/components/ui/`

**shadcn/ui Components**:
- Use existing shadcn/ui components when possible
- Import from `@/components/ui/[component-name]`
- Follow shadcn/ui patterns and API

**Custom Components**:
- `<BottomNavigation />` - Fixed bottom navigation (mobile only)
- `<SwipeCard />` - Swipeable card for Tinder-like UX
- `<EventPostmark />` - Artistic postage stamp badge for events

**Component Guidelines**:
- Functional components with TypeScript
- Use `React.FC` type if you prefer, but not required
- Props interface above component
- Use `cn()` utility for conditional classes: `cn('base-classes', condition && 'conditional-classes')`

---

## 🌐 Internationalization

**Context**: `src/contexts/LanguageContext.tsx`

**Supported Languages**: Russian (ru), English (en)

**Usage**:
```typescript
import { useLanguage } from '@/contexts/LanguageContext';

const Component = () => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div>
      <h1>{t('welcome.title')}</h1>
      <Button onClick={() => setLanguage('en')}>English</Button>
    </div>
  );
};
```

**Adding New Translations**:
1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Keep keys descriptive

**Translation Guidelines**:
- Always use `t()` for user-facing text
- Don't translate: technical terms, brand names, code
- Translate: UI labels, messages, descriptions, button text

---

## 🗂️ Type Definitions

**Location**: `src/types/`

**Files**:
- `user.ts` - User, Event, Match, Like, AloeVeraSong
- `chat.ts` - Chat, Message, GroupChat, PrivateChat

**Known Issues**:
- ⚠️ `Message` interface is duplicated in both files (different structures)
- Use `Message` from `chat.ts` for messaging features
- Use types from `user.ts` for match-related features

**Type Guidelines**:
- Use interfaces for object shapes
- Use types for unions and complex types
- Export all types
- Add JSDoc comments for complex types
- Use strict types (avoid `any`)

---

## 🔄 State Management

**Current Approach**:
- **Global State**: React Context for language/i18n only
- **Local State**: `useState` in page components
- **No Global User State**: User is hardcoded as `'current-user'`

**React Query**: Configured but not used yet. Will be used when backend is implemented.

**State Guidelines**:
- Keep state close to where it's used
- Lift state only when needed by multiple components
- Use `useState` for simple state
- Prepare for React Query migration (don't over-complicate state logic)

---

## 🚦 Routing

**Router**: React Router DOM v6

**Routes**:
```
/                              → Welcome (landing/auth)
/friends                       → Friends (search, likes, chats)
/talks                         → Talks (forum, event chats)
/aloevera                      → AloeVera (events, store, blog)
/aloevera/events/:eventId      → Event details
/aloevera/blog/:postId         → Blog post details
/aloevera/store/:itemId        → Store item details
/settings                      → Settings
```

**Legacy Redirects** (don't add new ones):
```
/search  → /friends
/events  → /aloevera
/likes   → /friends
/chats   → /talks
/profile → /settings
```

**Routing Guidelines**:
- Use `useNavigate()` for programmatic navigation
- Use `<Link>` for declarative navigation
- Use `useParams()` for route parameters
- Use `useSearchParams()` for query parameters
- Always handle 404 with `NotFound` component

---

## 🎯 Mock Data Guidelines

**Current State**: Mock data is embedded in page components.

**TODO**: Centralize mock data (see ISSUES.md #6)

**When Adding Mock Data**:
1. Define data at the top of the component (before the component function)
2. Use TypeScript types from `src/types/`
3. Use realistic data (real names, dates, descriptions)
4. Use Unsplash images: `https://images.unsplash.com/photo-[id]?w=800&h=400&fit=crop`
5. Keep IDs consistent across related data
6. Add comments explaining the mock data

**Example**:
```typescript
// Mock users for search
const mockUsers: User[] = [
  {
    id: '1',
    name: 'Анна',
    age: 25,
    bio: 'Обожаю музыку AloeVera',
    location: 'Москва',
    gender: 'female',
    profileImage: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=400&h=600&fit=crop',
    images: [],
    lastSeen: new Date(),
    isOnline: true,
    preferences: { ageRange: [22, 35], maxDistance: 50, showMe: 'everyone' },
    settings: { profileVisibility: 'public', anonymousLikes: false, language: 'ru', notifications: true }
  },
  // ... more users
];
```

---

## 🐛 Known Issues

**See [docs/ISSUES.md](./docs/ISSUES.md) for complete list.**

**Critical Issues to Be Aware Of**:
1. ❌ No backend - all data is mock
2. ❌ No authentication - user is hardcoded
3. ❌ No data persistence - changes are lost on refresh
4. ⚠️ TypeScript is loosely configured (see tsconfig.json)
5. ⚠️ No testing framework
6. ⚠️ Mock data embedded in components (should be centralized)
7. ⚠️ Duplicate `Message` interface in types

**Don't Try to Fix Without Context**:
- Backend implementation (requires full backend stack)
- Type system strictness (requires codebase-wide changes)
- Test setup (requires project decision on framework)

---

## ✅ Code Quality Guidelines

### TypeScript

```typescript
// ✅ Good
interface UserCardProps {
  user: User;
  onLike: (userId: string) => void;
  onPass: (userId: string) => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onLike, onPass }) => {
  // ...
};

// ❌ Avoid
const UserCard = (props: any) => {
  // ...
};
```

### Component Structure

```typescript
// ✅ Good: Clear separation of concerns
const Component = () => {
  // 1. Hooks
  const [state, setState] = useState();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // 2. Derived state / computations
  const filteredData = data.filter(...);

  // 3. Event handlers
  const handleClick = () => { /* ... */ };

  // 4. Effects (if any)
  useEffect(() => { /* ... */ }, []);

  // 5. Render
  return <div>...</div>;
};
```

### Conditional Rendering

```typescript
// ✅ Good
{isLoading && <Spinner />}
{error && <ErrorMessage error={error} />}
{data && <DataList data={data} />}

// ❌ Avoid ternaries for simple conditions
{isLoading ? <Spinner /> : null}
```

### Event Handlers

```typescript
// ✅ Good: Named handlers
const handleLike = () => {
  console.log('Liked:', user.name);
  onLike(user.id);
};

<Button onClick={handleLike}>Like</Button>

// ❌ Avoid inline arrow functions (re-renders)
<Button onClick={() => onLike(user.id)}>Like</Button>

// ℹ️ Inline is OK for simple toggles
<Button onClick={() => setOpen(!open)}>Toggle</Button>
```

---

## 🎨 UI/UX Guidelines

### Mobile-First Design

```typescript
// ✅ Good: Mobile-first, then desktop
<div className="p-4 md:p-6 lg:p-8">
  <h1 className="text-xl md:text-2xl lg:text-3xl">Title</h1>
</div>

// ❌ Avoid desktop-first
<div className="p-8 md:p-4">
```

### Responsive Images

```typescript
// ✅ Good
<img
  src={user.profileImage}
  alt={user.name}
  className="w-full h-48 object-cover rounded-lg"
/>

// ❌ Avoid fixed dimensions without object-cover
<img src={user.profileImage} className="w-400 h-600" />
```

### Loading States

```typescript
// ✅ Good: Show loading state
if (isLoading) {
  return (
    <div className="flex items-center justify-center p-8">
      <Spinner />
    </div>
  );
}

// ❌ Avoid rendering nothing
if (isLoading) return null;
```

### Empty States

```typescript
// ✅ Good: Friendly empty state
{matches.length === 0 && (
  <div className="text-center p-8">
    <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
    <p className="text-lg font-semibold">{t('likes.noMatches')}</p>
    <p className="text-sm text-muted-foreground">
      Keep swiping to find your match!
    </p>
  </div>
)}

// ❌ Avoid bare text
{matches.length === 0 && <p>No matches</p>}
```

---

## 🔧 Development Workflow

### Adding a New Feature

1. **Understand the context**: Read relevant docs (FEATURES.md, ARCHITECTURE.md)
2. **Check for existing patterns**: Look at similar existing features
3. **Create types**: Define TypeScript interfaces in `src/types/`
4. **Create mock data**: Add realistic mock data
5. **Build UI**: Create/modify page component
6. **Add translations**: Add i18n keys to LanguageContext
7. **Test manually**: Test in browser (mobile and desktop views)
8. **Update docs**: Update FEATURES.md if significant

### Modifying Existing Code

1. **Read the file first**: Understand existing patterns
2. **Maintain consistency**: Follow existing code style
3. **Don't break**: Ensure existing functionality still works
4. **Test changes**: Manual testing in browser
5. **Update types**: Keep TypeScript types in sync

### Adding UI Components

1. **Check shadcn/ui first**: Use existing component if possible
2. **Location**: `src/components/ui/[component-name].tsx`
3. **Follow patterns**: Look at existing custom components
4. **TypeScript**: Define props interface
5. **Styling**: Use Tailwind + design system colors
6. **Documentation**: Add JSDoc comments if complex

---

## 📦 Dependencies

### Adding New Dependencies

**Before adding a dependency**:
1. Check if it's already in package.json
2. Consider if it's really needed
3. Check bundle size impact
4. Ensure it's actively maintained

**Preferred libraries** (already in project):
- UI: shadcn/ui components (Radix UI)
- Icons: lucide-react
- Dates: date-fns
- Forms: react-hook-form + zod (configured but not used yet)
- Animations: tailwindcss-animate

**Don't add without discussion**:
- State management libraries (Redux, MobX, etc.)
- UI libraries (Material-UI, Ant Design, etc.) - we use shadcn/ui
- CSS frameworks (Bootstrap, etc.) - we use Tailwind

---

## 🚀 Future Backend Integration

**When backend is implemented**:

1. **Replace mock data with API calls**:
```typescript
// Current (mock)
const users = mockUsers;

// Future (API)
const { data: users, isLoading } = useQuery({
  queryKey: ['users', filters],
  queryFn: () => api.getUsers(filters)
});
```

2. **Add loading states**:
```typescript
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
```

3. **Handle authentication**:
```typescript
const { user, isAuthenticated } = useAuth();

if (!isAuthenticated) {
  return <Navigate to="/" />;
}
```

4. **Add error handling**:
```typescript
try {
  await api.likeUser(userId);
  toast.success('Liked!');
} catch (error) {
  toast.error('Failed to like user');
}
```

**See [docs/BACKEND_PLAN.md](./docs/BACKEND_PLAN.md) for complete backend architecture.**

---

## 📚 Documentation

### When to Update Docs

**Update README.md** when:
- Adding major features
- Changing setup instructions
- Updating tech stack

**Update docs/FEATURES.md** when:
- Adding new features
- Changing feature behavior
- Adding new pages

**Update docs/ISSUES.md** when:
- Discovering new issues
- Fixing existing issues

**Update docs/ARCHITECTURE.md** when:
- Changing architecture patterns
- Adding new layers/systems
- Changing tech stack

**Update AGENTS.md (this file)** when:
- Adding new conventions
- Changing code patterns
- Adding new guidelines

---

## 🎯 Common Tasks

### Adding a New Page

1. Create `src/pages/PageName.tsx`
2. Follow page component structure (see above)
3. Add route to `src/App.tsx`
4. Add navigation link to `BottomNavigation` (if needed)
5. Add translations to `LanguageContext`
6. Update `docs/FEATURES.md`

### Adding a New UI Component

1. Create `src/components/ui/component-name.tsx`
2. Use TypeScript + props interface
3. Use Tailwind + design system
4. Export component
5. Import and use in pages

### Adding Mock Data

1. Define at top of page component
2. Use TypeScript types
3. Use realistic data
4. Keep IDs consistent
5. Add comments

### Fixing Styling Issues

1. Check if custom class exists (`.btn-like`, `.profile-card`, etc.)
2. Use Tailwind utilities for simple cases
3. Use CSS variables for colors (never hardcode hex colors)
4. Test on mobile and desktop
5. Check dark mode (if applicable)

### Adding Translations

1. Open `src/contexts/LanguageContext.tsx`
2. Add key to both `ru` and `en` objects
3. Use dot notation: `'section.key'`
4. Use in component: `{t('section.key')}`

---

## ❓ FAQ for AI Agents

**Q: Should I implement backend functionality?**  
A: No. This is a frontend-only app. Use mock data. Backend will be implemented later per BACKEND_PLAN.md.

**Q: Should I fix TypeScript strict mode issues?**  
A: No. This requires codebase-wide changes. It's in ISSUES.md as known technical debt.

**Q: Should I add tests?**  
A: Only if specifically requested. No testing framework is set up yet.

**Q: Can I use a different UI library?**  
A: No. This project uses shadcn/ui exclusively. Use existing components or create custom ones.

**Q: Should I make API calls?**  
A: No. There's no backend yet. Use mock data defined in components.

**Q: Can I add dark mode?**  
A: The design system supports it (check index.css), but it's not implemented. Only add if specifically requested.

**Q: Should I centralize mock data?**  
A: Yes, if working on ISSUES.md #6. Otherwise, keep current pattern (embedded in components) for consistency.

**Q: Where do I put images?**  
A: Use Unsplash URLs for mock images. Real image upload will be backend feature.

**Q: Should I optimize performance?**  
A: Only if there's a specific performance issue. Don't prematurely optimize.

**Q: Can I refactor large components?**  
A: Only if specifically requested or if making changes that naturally lead to refactoring. Maintain existing patterns.

---

## 🤝 Best Practices Summary

✅ **DO**:
- Follow existing patterns and conventions
- Use TypeScript properly (with types from `src/types/`)
- Use design system colors (CSS variables)
- Use i18n for all user-facing text
- Add mock data with realistic content
- Test manually in browser (mobile + desktop)
- Keep components focused and readable
- Add comments for complex logic
- Update documentation when adding features

❌ **DON'T**:
- Add backend functionality (it's a frontend-only app)
- Make breaking changes without understanding impact
- Add new dependencies without good reason
- Hardcode colors (use CSS variables)
- Skip translations (use `t()` function)
- Ignore TypeScript errors (even if config is loose)
- Over-engineer solutions (keep it simple)
- Remove existing functionality without confirmation

---

## 📞 Getting Help

**For questions about**:
- **Features**: See [docs/FEATURES.md](./docs/FEATURES.md)
- **Architecture**: See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **Known issues**: See [docs/ISSUES.md](./docs/ISSUES.md)
- **Backend plans**: See [docs/BACKEND_PLAN.md](./docs/BACKEND_PLAN.md)
- **Setup/deployment**: See [README.md](./README.md)

**If you're unsure**:
1. Read the relevant documentation
2. Look at similar existing code
3. Ask the user/developer for clarification

---

**Remember**: This is a well-structured frontend app with a solid foundation. Maintain the existing patterns and quality. The main limitation is the lack of backend—everything else is intentional design decisions.

Good luck! 🚀
