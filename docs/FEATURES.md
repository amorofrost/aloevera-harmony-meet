# Feature Specifications

**AloeVera Harmony Meet** - Detailed Feature Documentation

**Last Updated**: April 18, 2026

**Events:** See **[EVENTS.md](./EVENTS.md)** (visibility, invites, forum topic access, admin).

---

## 🎯 Application Purpose

AloeVera Harmony Meet is a fan community platform for AloeVera music band enthusiasts that combines:
- **Dating/Matchmaking** - Connect fans romantically based on music preferences
- **Social Networking** - Forums, group chats, and community interaction
- **Event Management** - Concert registrations, meetups, and exclusive events
- **E-commerce** - Band merchandise store
- **Content Hub** - Blog, band news, and information

---

## 🚪 1. Welcome / Authentication

**Route**: `/`  
**Component**: `src/pages/Welcome.tsx`  
**Status**: Mock UI only, no actual authentication

### Features

#### 1.1 Landing Page
- Hero section with background image
- AloeVera brand theming (flame, gold, ocean colors)
- Language switcher (Russian/English)
- Tagline: "Dating for Music Lovers" / "Знакомства для тех, кто на одной волне"

#### 1.2 Login Form
- Email input
- Password input
- Sign In button
- Link to registration
- **Current**: Form doesn't actually authenticate

#### 1.3 Registration Form
- Email, password, age, gender, location, bio fields
- Gender options: Male, Female, Other
- Create Account button
- Link to login
- **Current**: Form doesn't create account

### Mock Behavior
- Both forms just log data to console
- No validation
- No API calls
- No session management

### Future Implementation
- Email/password authentication
- OAuth (Google, Facebook, Spotify)
- Email verification
- Password reset
- Terms of service acceptance
- Age verification (18+)

---

## 💑 2. Friends (Dating Features)

**Route**: `/friends`  
**Component**: `src/pages/Friends.tsx`  
**Status**: Full mock UI with interactions

### 2.1 Search Tab (Swipe Matching)

#### Features
- **Swipeable profile cards** with Tinder-like UX
- Current user profile display:
  - Name, age, location
  - Profile image (large)
  - Bio text
  - Events attended (with postmark badges)
  - Favorite AloeVera song
  - Online status indicator
- **Action buttons**:
  - Like (heart icon, pink gradient)
  - Pass (X icon, gray gradient)
  - Info (details view toggle)
- **Swipe gestures** (via `SwipeCard` component)
- Navigation between profiles

#### Mock Data
- 4 mock users (Анна, Дмитрий, Елена, Мария)
- Events attended per user
- Favorite songs
- Online status

#### Future Implementation
- User preferences filtering (age range, distance, gender)
- Matching algorithm based on:
  - Music preferences (favorite songs, albums)
  - Event attendance overlap
  - Location proximity
  - Common interests
- Unlimited user pool from database
- "No more profiles" state when filtered list is empty
- Super likes / limited likes per day

---

### 2.2 Likes Tab

#### 2.2.1 Matches Sub-Tab
**Purpose**: Show mutual likes where both users liked each other

**Display**:
- Grid of matched user cards
- Profile image, name, age, location
- Unread indicator
- "New match" badge
- Tap to open chat

**Mock Data**: 1 match (with Анна)

**Future**:
- Match timestamp
- Match percentage
- Icebreaker suggestions
- Unmatch functionality

#### 2.2.2 Sent Likes Sub-Tab
**Purpose**: Show likes sent by current user (not yet matched)

**Display**:
- List of users you liked
- Profile preview
- Pending status
- Option to unlike

**Mock Data**: 1 sent like (to Дмитрий)

**Future**:
- See if they viewed your profile
- "Liked you back" notification
- Expiration of old likes

#### 2.2.3 Received Likes Sub-Tab
**Purpose**: Show likes received from other users (not yet matched)

**Display**:
- Blurred or teased profiles (premium feature idea)
- Count of likes received
- Option to view and match

**Mock Data**: 1 received like (from Елена)

**Future**:
- Premium feature: see who liked you
- Free: see blurred preview only
- Quickly swipe through received likes

---

### 2.3 Chats Tab (Private Messaging)

#### Features
- **Chat list view**:
  - List of private chats with matches
  - Last message preview
  - Timestamp (smart formatting: "14:30" or "5 Feb")
  - Unread indicator
  - Online status of other user
- **Chat conversation view**:
  - Header with user info, online status
  - Message bubbles (left: them, right: you)
  - Message timestamps
  - Message input with send button
  - Back button to chat list

**Mock Data**: 1 chat with Анна with sample message

**Current Behavior**: Messages can be typed but don't persist

**Future Implementation**:
- Real-time messaging (WebSocket/Socket.io)
- Message persistence
- Read receipts
- Typing indicators
- Image/emoji support
- Voice messages
- Push notifications
- Block/report user
- Delete chat

---

## 🗣️ 3. Talks (Community Features)

**Route**: `/talks`  
**Component**: `src/pages/Talks.tsx`  
**Status**: Forum + **event discussions** use the API in API mode (`forumsApi`)

### 3.1 Forum Tab

- **Sections** (General, Music, Cities, Offtopic): topics from `/api/v1/forum/sections/{id}/topics` (not the reserved `events` section).
- **Topic detail / replies:** rank gating; `noviceVisible` / `noviceCanReply` per topic.

### 3.2 Event discussions (same page)

- **Per-event forum threads** from `GET /api/v1/forum/event-discussions/summary` and `.../event-discussions/{eventId}/topics` (not the older mock “event group chat” concept).
- Threads are **filtered server-side** (public vs attendees-only vs specific user IDs). See **[EVENTS.md](./EVENTS.md)**.

---

## 🎸 4. AloeVera (Band Hub)

**Route**: `/aloevera`  
**Component**: `src/pages/AloeVera.tsx`  
**Status**: Tabs wired to API in API mode (`eventsApi`, etc.); mock data when `VITE_API_MODE=mock`

### 4.1 Events Tab

#### Features (API mode)
- **Event cards** with image, title, **multiline description** (line breaks preserved), category, **free-text price** (no auto currency suffix), date/location, capacity, **Interested** count, **secret** badges when applicable.
- **Navigate** to event detail; **interest** toggle is separate from **attendance** (invite-based registration on the backend).

**Visibility:** Public / teaser / hidden secret events follow backend rules (see **[EVENTS.md](./EVENTS.md)**).

**Mock mode:** Uses `src/data/mockEvents.ts` with the same shape (string `price`, etc.).

---

### 4.2 Event Details Page

**Route**: `/aloevera/events/:eventId`  
**Component**: `src/pages/EventDetails.tsx`

#### Features
- Full event information; **external URL** (tickets/official site) when provided.
- **Invite code** field / deep link `?code=` support for unlocking secret events per API.
- **Interested** vs **attend** (registration with invite code) per product rules.
- Description rendered with **multiline** support.

**See [EVENTS.md](./EVENTS.md)** for the full matrix.

---

### 4.3 Store Tab

#### Features
- **Product grid** (2 columns):
  - Product image
  - Product title
  - Category badge (Одежда, Музыка, Мерч)
  - Price in rubles (₽)
- **Product categories**:
  - Clothing (Одежда)
  - Music (Музыка) - Vinyl, CDs
  - Merch (Мерч) - Posters, accessories

**Mock Products**:
1. T-shirt "Новые горизонты" - 2500₽
2. Vinyl "Первый альбом" - 3500₽
3. Poster "AloeVera Fest 2024" - 800₽
4. Hoodie "AloeVera" - 4500₽

**Interaction**: Click product → navigate to product details

**Future Implementation**:
- Shopping cart
- Checkout flow
- Payment integration (Stripe, PayPal)
- Size/color variants
- Product reviews
- Wishlist
- Limited edition items
- Pre-orders
- Order tracking
- Discount codes

---

### 4.4 Store Item Details Page

**Route**: `/aloevera/store/:itemId`  
**Component**: `src/pages/StoreItem.tsx`

#### Features (Mock)
- Product images (gallery)
- Title, price, description
- Size/variant selector
- Quantity selector
- Add to cart button
- Related products

---

### 4.5 Blog Tab

#### Features
- **Blog post cards**:
  - Featured image
  - Title and excerpt
  - Publish date
  - Author
  - Tags (filter buttons)
- **Tag filtering**:
  - "Все" (All)
  - Tag badges from all posts (Студия, Альбом, Тур, Концерт, Интервью)
  - Click tag → filter posts

**Mock Posts**:
1. "За кулисами нового альбома" - Feb 20, 2024, tags: [Студия, Альбом]
2. "Итоги тура 2023" - Jan 15, 2024, tags: [Тур, Концерт]
3. "Интервью: О вдохновении и музыке" - Feb 10, 2024, tags: [Интервью, Альбом]

**Interaction**: Click post → navigate to full blog post

**Future Implementation**:
- Comments on posts
- Like/share posts
- Subscribe to blog updates
- RSS feed
- Search posts
- Related posts
- Author profiles

---

### 4.6 Blog Post Details Page

**Route**: `/aloevera/blog/:postId`  
**Component**: `src/pages/BlogPost.tsx`

#### Features (Mock)
- Full article content
- Hero image
- Publish date, author, tags
- Social share buttons
- Back navigation

**Future**:
- Comments section
- Related posts
- Author bio
- Newsletter signup

---

## ⚙️ 5. Settings

**Route**: `/settings`  
**Component**: `src/pages/SettingsPage.tsx`  
**Status**: Mock UI with form controls

### Features

#### 5.1 Profile Section
- **View mode**:
  - Profile image
  - Name, age, location
  - Bio
  - Events attended badges
  - Favorite song
  - Edit button
- **Edit mode**:
  - Name input
  - Age input
  - Location input
  - Bio textarea
  - Save/Cancel buttons

#### 5.2 Preferences Section
- Age range slider (18-65)
- Maximum distance slider (km)
- Show me: dropdown (Everyone, Men, Women, Non-binary)

#### 5.3 Privacy Settings
- Profile visibility: Public / Private / Friends only
- Anonymous likes toggle
- Online status visibility (future)

#### 5.4 App Settings
- Language: Russian / English toggle
- Notifications toggle
- Dark mode toggle (future)

#### 5.5 Account Actions
- Sign Out button (currently just logs action)
- Delete Account (future)

**Current**: Settings can be changed in UI but don't persist

**Future**:
- Save settings to database
- Email preferences
- Block list
- Privacy controls (who can message, who can see profile)
- Linked accounts (Spotify, etc.)
- Subscription management (premium features)

---

## 🧭 6. Navigation

### Bottom Navigation Bar

**Component**: `src/components/ui/bottom-navigation.tsx`  
**Visibility**: Mobile only (hidden on desktop)

**Tabs**:
1. **Talks** (MessageSquare icon) → `/talks`
2. **Friends** (Users icon) → `/friends`
3. **AloeVera** (Music icon) → `/aloevera`
4. **Settings** (Settings icon) → `/settings`

**Features**:
- Active state highlighting with glow effect
- Icon-only on mobile
- Fixed to bottom of viewport
- Smooth transitions

**Future**: Desktop sidebar navigation

---

## 📱 7. Mobile-Specific Features

### Swipe Gestures
- Swipe right on profile card → Like
- Swipe left on profile card → Pass
- Smooth animations
- Haptic feedback (device-dependent)

### Bottom Sheet Modals
- Used for detail views on mobile
- Smooth slide-up animation

### Touch Optimizations
- Large touch targets (44x44px minimum)
- Touch-friendly spacing
- Pull-to-refresh (future)

---

## 🎨 8. Design System Features

### Custom Gradients
- **Like button**: Coral → Flame (pink to orange)
- **Pass button**: Gray gradient
- **Match button**: Gold gradient
- **Hero backgrounds**: Gold → Flame → Ocean

### Animations
- Floating animation for decorative elements
- Hover scale effects on buttons
- Smooth tab transitions
- Card hover shadows
- Navigation glow effects

### Event Postmarks
**Component**: `src/components/ui/event-postmark.tsx`

Artistic postage stamp-style badges for events:
- Event location
- Event date
- Decorative border
- Category-specific styling
- Used as collectible indicators on profiles

---

## 🎖️ 9. Roles & Ranks

### Ranks (auto-computed)

- **Novice** — default. Baseline permissions.
- **Active Member** — 5 forum replies OR 3 likes received OR 1 event attended.
- **Friend of Aloe** — 25 replies OR 15 likes OR 3 events.
- **Aloe Crew** — 100 replies OR 50 likes OR 10 events OR 10 matches.

Thresholds live in the `appconfig` Azure Table (partition `rank_thresholds`) and are cached for 1 hour on the backend. An admin can override any single user's rank via `PUT /api/v1/users/{id}/rank-override`.

### Staff Roles (manually assigned)

- `none` — no staff privileges.
- `moderator` — can delete any reply/topic, pin topics, ban users (effective level 4).
- `admin` — can assign staff roles, override ranks, manage events/blog/store (effective level 5).

Staff roles are stored on `UserEntity.StaffRole`, returned on `UserDto.staffRole`, and embedded as the `staffRole` JWT claim so action filters can authorise requests without hitting storage.

### Badges

`<UserBadges rank staffRole />` (in `src/components/ui/user-badges.tsx`) renders a coloured rank dot plus the translated rank name, and — when staff role is set — a coloured uppercase pill. Rendered on forum reply headers, on the profile/settings page, and on peer profiles in the swipe card and chat-list items. Novice + `none` renders nothing (null return) so unranked users stay visually quiet.

### Gating

Forum sections can set `minRank` (stored on `ForumSectionEntity`) — sections below a user's effective level are shown with a lock icon on Talks and clicking them triggers a toast instead of navigating. Topics can additionally set `noviceVisible=false` (hidden from novices entirely) and `noviceCanReply=false` (novices can read but the reply form is replaced with a restricted-reply message). Both flags are controlled per-topic via toggles in `CreateTopicModal`.

### Admin endpoints

- `PUT /api/v1/users/{id}/role` — assign staff role (admin-only)
- `PUT /api/v1/users/{id}/rank-override` — override computed rank (admin-only)
- `GET /api/v1/admin/config` — read current `appconfig` values (admin-only)
- `PUT /api/v1/forum/topics/{id}` — edit topic; author + moderator can update `noviceVisible`; only moderator+ can pin/lock

See `docs/ARCHITECTURE.md` ("ACL enforcement" subsection) for how `PermissionGuard`, `RequireStaffRoleAttribute`, and `RequirePermissionAttribute` compose to authorise these endpoints.

---

## 🔮 Future Feature Ideas

### Premium Features
- See who liked you (received likes unblurred)
- Unlimited likes
- Super likes (priority matching)
- Profile boost
- Advanced filters
- Rewind (undo pass)
- No ads

### Social Features
- Friend system (non-romantic)
- Follow other users
- Public posts/feed
- Story-like temporary posts
- User badges/achievements
- Leaderboards (concert attendance, etc.)

### Music Integration
- Spotify integration (sync favorite songs)
- Song previews in profiles
- Playlist sharing
- "Our song" for matches
- Concert setlist voting

### Event Enhancements
- Live streaming of concerts
- Virtual events
- After-party coordination
- Ride sharing to events
- Hotel booking integration

### Gamification
- Event postmark collection
- Achievement badges
- Profile completion rewards
- Referral rewards
- Daily login bonuses

---

## 📊 Analytics & Metrics (Future)

### User Metrics
- Profile views
- Like rate
- Match rate
- Message response rate
- Event attendance

### App Metrics
- DAU/MAU
- Retention rate
- Feature usage
- Conversion funnels
- Performance metrics

---

## 🔒 Privacy & Safety Features (Future)

- Report user
- Block user
- Photo verification
- Identity verification
- Safe dating tips
- Emergency contacts
- Location sharing controls
- Incognito mode
- Hide/show profile temporarily

---

**For implementation details, see**:
- [ARCHITECTURE.md](./ARCHITECTURE.md) - Technical architecture
- [BACKEND_PLAN.md](./BACKEND_PLAN.md) - Backend roadmap
- [ISSUES.md](./ISSUES.md) - Known issues
