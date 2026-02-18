# Known Issues & Technical Debt

This document catalogs all identified issues, technical debt, and areas for improvement in the AloeVera Harmony Meet application.

**Last Updated**: February 17, 2026  
**Status**: Mock Application - No Backend Implementation

---

## 🔴 Critical Issues

### 1. No Backend Implementation
**Severity**: Critical  
**Impact**: Application is non-functional for real-world use

All data is hardcoded mock data within components. No actual data persistence, API calls, or server communication exists.

**Affected Areas**:
- User authentication
- Profile management
- Matching system
- Messaging
- Event management
- Store functionality
- Blog posts
- Forum system

**Resolution**: Requires full backend implementation. See [BACKEND_PLAN.md](./BACKEND_PLAN.md).

---

### 2. No Authentication/Authorization System
**Severity**: Critical  
**Impact**: Security vulnerability, no user management

- Welcome page has login/register forms but they don't actually authenticate
- No session management
- No protected routes
- Current user is hardcoded as `'current-user'`
- Anyone can access any feature without authentication

**Resolution**: Implement JWT or session-based authentication with protected routes.

---

### 3. No Data Persistence
**Severity**: Critical  
**Impact**: All user actions are lost on refresh

- Likes/matches are not saved
- Messages disappear on refresh
- Event registrations are lost
- Profile changes don't persist
- Settings changes are temporary

**Resolution**: Implement database integration and state persistence.

---

## 🟠 High Priority Issues

### 4. Loose TypeScript Configuration
**Severity**: High  
**Impact**: Type safety compromised, potential runtime errors

**Current `tsconfig.json` settings**:
```json
{
  "noImplicitAny": false,
  "noUnusedParameters": false,
  "skipLibCheck": true,
  "allowJs": true,
  "noUnusedLocals": false,
  "strictNullChecks": false
}
```

**Problems**:
- Missing type annotations won't be caught
- Implicit `any` types allowed
- Null/undefined errors won't be caught at compile time
- Unused code won't be flagged

**Resolution**: Gradually enable strict mode:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

---

### 5. No Testing Framework
**Severity**: High  
**Impact**: Code quality, reliability, refactoring confidence

- No unit tests
- No integration tests
- No E2E tests
- No test infrastructure

**Resolution**: Add testing setup:
- **Vitest** for unit/integration tests (Vite-native)
- **React Testing Library** for component tests
- **Playwright** or **Cypress** for E2E tests

**Recommended Structure**:
```
src/
  __tests__/
    unit/
    integration/
  pages/
    __tests__/
      Friends.test.tsx
```

---

### 6. Mock Data Embedded in Components
**Severity**: High  
**Impact**: Code maintainability, data consistency, reusability

Mock data is defined directly in page components:
- `Friends.tsx`: Users, events, matches, likes, chats
- `AloeVera.tsx`: Events, store items, blog posts
- `Talks.tsx`: Forum topics, group chats
- `EventDetails.tsx`: Event attendees
- `SettingsPage.tsx`: User profile

**Problems**:
- Duplication (same events defined in multiple files)
- Inconsistent data (IDs don't match across files)
- Hard to update
- Hard to test
- Can't share data between components

**Resolution**: Centralize mock data:
```typescript
// src/data/mockData.ts or src/mocks/
export const mockUsers: User[] = [...]
export const mockEvents: Event[] = [...]
export const mockStoreItems: StoreItem[] = [...]
// etc.
```

Consider using **MSW (Mock Service Worker)** for API mocking when backend development begins.

---

### 7. Type Inconsistencies
**Severity**: High  
**Impact**: Type safety, potential bugs

**Duplicate `Message` interface**:
- Defined in both `src/types/user.ts` (lines 43-50) and `src/types/chat.ts` (lines 12-20)
- Different properties and structure
- Creates confusion about which to use

**Resolution**: 
- Remove `Message` from `user.ts`
- Use only the `Message` interface from `chat.ts`
- Update imports in all files
- Ensure `Match` interface properly references the correct `Message` type

---

### 8. Incomplete Internationalization
**Severity**: High  
**Impact**: User experience for non-Russian speakers

**Problems**:
- Many UI strings are hardcoded in Russian (not translated)
- Page components have mixed translated/untranslated strings
- No translation for error messages
- Forum section names hardcoded
- Blog content not translatable

**Examples of untranslated strings**:
- Forum sections: "Общий", "Музыка", "Города", "Офтопик"
- Store categories: "Одежда", "Музыка", "Мерч"
- Event categories: "Концерт", "Встреча", "Фестиваль"
- Chat placeholders and system messages

**Resolution**:
- Add all strings to `LanguageContext` translations
- Use `t()` function consistently throughout
- Consider using i18next for more robust i18n

---

## 🟡 Medium Priority Issues

### 9. Lack of Error Handling
**Severity**: Medium  
**Impact**: Poor UX when things go wrong

- No error boundaries
- No try/catch blocks
- No loading states for async operations
- No error messages for failed actions
- No fallback UI for errors

**Resolution**:
- Add React Error Boundaries
- Implement proper error handling for all async operations
- Add loading indicators
- Add user-friendly error messages

---

### 10. No Validation on Forms
**Severity**: Medium  
**Impact**: Data quality, UX

While React Hook Form and Zod are included in dependencies, they're not actually used in any forms:
- Login/register forms have no validation
- Profile edit forms have no validation
- Message inputs have no validation
- Settings changes have no validation

**Resolution**: Implement form validation with React Hook Form + Zod schemas.

---

### 11. Accessibility Issues
**Severity**: Medium  
**Impact**: Users with disabilities, SEO

**Missing**:
- Semantic HTML in many places
- ARIA labels on interactive elements
- Keyboard navigation support
- Focus management
- Alt text on some images
- Skip navigation links
- Proper heading hierarchy in some components

**Resolution**: 
- Add ARIA attributes
- Implement keyboard navigation
- Test with screen readers
- Add focus traps for modals
- Use semantic HTML elements

---

### 12. No State Management Strategy
**Severity**: Medium  
**Impact**: Scalability, code organization

**Current approach**:
- React Context only for language (good)
- Local component state for everything else
- TanStack React Query configured but unused
- No global state for user, auth, or app state

**Problems**:
- Can't share state between pages
- Auth state is hardcoded
- User profile not globally accessible
- Matches/likes not accessible outside Friends page

**Resolution**: 
- Use TanStack React Query for server state (when backend exists)
- Consider Zustand or Jotai for client-side global state
- Keep Context API for theme/language

---

### 13. Swipe Functionality Incomplete
**Severity**: Medium  
**Impact**: Core dating feature UX

The `SwipeCard` component exists (`src/components/ui/swipe-card.tsx`) but:
- Swipe gestures may not work smoothly on all devices
- No swipe animation feedback
- No undo functionality
- No algorithm for user recommendations
- No filtering based on preferences

**Resolution**: 
- Test and improve gesture handling
- Add swipe animations
- Implement user recommendation algorithm (backend)
- Add preference-based filtering

---

### 14. Image Handling Issues
**Severity**: Medium  
**Impact**: Performance, UX

**Problems**:
- All images are from Unsplash URLs (external dependency)
- No image optimization
- No lazy loading
- No image upload functionality
- No image validation
- Same placeholder images used for different users

**Resolution**:
- Implement image upload functionality
- Add image optimization (sharp, cloudinary, or similar)
- Implement lazy loading
- Add proper CDN or local storage
- Use unique, appropriate images

---

### 15. Responsive Design Gaps
**Severity**: Medium  
**Impact**: UX on various devices

- Mobile-first approach is good
- Bottom navigation only shown on mobile
- Some components may not work well on tablets
- Desktop experience could be enhanced with sidebar navigation
- Some text may be too small on mobile

**Resolution**:
- Test on various devices and screen sizes
- Add tablet-specific layouts
- Consider desktop sidebar navigation
- Ensure all touch targets are at least 44x44px

---

## 🟢 Low Priority Issues

### 16. Package.json Name Mismatch
**Severity**: Low  
**Impact**: Project identity confusion

`package.json` has name: `"vite_react_shadcn_ts"` (generic template name) instead of `"aloevera-harmony-meet"`

**Resolution**: Update package.json name field.

---

### 17. Incomplete Docker Configuration
**Severity**: Low  
**Impact**: Deployment, containerization

Docker files exist but:
- No documentation on how to use them
- Not clear if they work with current setup
- No environment variable handling
- nginx.conf is present but may need updates

**Resolution**: Test Docker setup, document usage, add environment configuration.

---

### 18. No Environment Configuration
**Severity**: Low  
**Impact**: Configuration management

- No `.env` file or `.env.example`
- API URLs will need to be hardcoded
- No way to configure different environments (dev/staging/prod)

**Resolution**: 
- Add `.env.example` with template variables
- Document all required environment variables
- Use Vite's env variable system (`import.meta.env`)

---

### 19. Unused Dependencies
**Severity**: Low  
**Impact**: Bundle size, maintenance

Several packages are included but not used or minimally used:
- `@tanstack/react-query` - Configured but not used
- `recharts` - Imported but no charts implemented
- `next-themes` - Dark mode package but dark mode not implemented
- `react-resizable-panels` - Not used anywhere
- `vaul` - Drawer component not used
- `cmdk` - Command palette not used

**Resolution**: 
- Remove unused packages OR
- Implement features that use them (e.g., dark mode, analytics charts)

---

### 20. No Analytics or Monitoring
**Severity**: Low  
**Impact**: Business insights, debugging

- No analytics integration (GA, Mixpanel, etc.)
- No error tracking (Sentry, LogRocket, etc.)
- No performance monitoring
- No user behavior tracking

**Resolution**: Add analytics and monitoring when backend is implemented.

---

### 21. No PWA Support
**Severity**: Low  
**Impact**: Mobile experience, offline functionality

No Progressive Web App capabilities:
- No service worker
- No offline support
- No install prompt
- No push notifications

**Resolution**: Add PWA support using Vite PWA plugin.

---

### 22. Inconsistent Date Formatting
**Severity**: Low  
**Impact**: Code consistency

Date formatting is done manually in multiple places with `Intl.DateTimeFormat`:
- `Friends.tsx`: `formatDateShort`, `formatTime`, `formatChatDate`
- `AloeVera.tsx`: `formatDate`, `formatBlogDate`
- Different formats in different components

**Resolution**: Create centralized date formatting utilities using date-fns.

---

### 23. Missing Metadata and SEO
**Severity**: Low  
**Impact**: SEO, social sharing

`index.html` has basic metadata but:
- No Open Graph tags
- No Twitter Card tags
- Generic title/description
- No favicon variation (only basic)
- No structured data (JSON-LD)

**Resolution**: Add comprehensive metadata for SEO and social sharing.

---

### 24. No Content Moderation System
**Severity**: Low (for mock) / High (for production)  
**Impact**: Community safety

No consideration for:
- Inappropriate content detection
- User reporting
- Admin moderation interface
- Spam prevention
- Blocking/muting users

**Resolution**: Design and implement moderation system when backend is built.

---

### 25. Event Postmark Component Unused
**Severity**: Low  
**Impact**: Visual design opportunity missed

The artistic `EventPostmark` component is imported but its full potential isn't utilized:
- Only shown on event cards in `AloeVera.tsx`
- Could be used more prominently
- Could be collected as "stamps" by users who attended events

**Resolution**: Enhance event postmark feature as a collectible/badge system.

---

## 📊 Summary by Category

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| **Backend/Data** | 3 | 2 | 1 | 1 | 7 |
| **TypeScript/Code Quality** | 0 | 3 | 1 | 1 | 5 |
| **UX/Features** | 0 | 1 | 4 | 3 | 8 |
| **Infrastructure** | 0 | 0 | 1 | 4 | 5 |
| **Total** | **3** | **6** | **7** | **9** | **25** |

---

## 🎯 Recommended Priority Order

1. **Implement Backend** (Issues #1, #2, #3) - Foundation for everything
2. **Centralize Mock Data** (Issue #6) - Improves development experience immediately
3. **Fix Type Issues** (Issues #4, #7) - Prevents bugs during development
4. **Add Testing** (Issue #5) - Enables confident refactoring
5. **Complete i18n** (Issue #8) - Better UX
6. **Add Form Validation** (Issue #10) - Data quality
7. **Implement State Management** (Issue #12) - Scalability
8. **Add Error Handling** (Issue #9) - Resilience
9. **Improve Swipe UX** (Issue #13) - Core feature polish
10. **Everything else** - Based on priority

---

## 📝 Notes

- This is a mock application created with Lovable platform
- Many issues are expected given the current stage (no backend)
- Some issues (like unused dependencies) may be intentional for future features
- Frontend code quality is generally good considering it's generated code
- Design system and component architecture are solid foundations

---

**Next Steps**: See [BACKEND_PLAN.md](./BACKEND_PLAN.md) for implementation roadmap.
