# Feature Specifications

**AloeVera Harmony Meet** - Detailed Feature Documentation

**Last Updated**: February 17, 2026

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
**Status**: Mock UI with forum and group chats

### 3.1 Forum Tab

#### Features
- **Forum sections**:
  1. **Общий** (General) - General band discussion
  2. **Музыка** (Music) - Song discussions, reviews
  3. **Города** (Cities) - City-specific fan groups
  4. **Офтопик** (Offtopic) - Non-band topics
- **Topic list** per section:
  - Topic title
  - Author name and avatar
  - Reply count
  - Last activity timestamp
  - Pinned indicator
- **Topic detail view**:
  - Original post
  - Replies thread
  - Reply button
  - Upvote/downvote (not implemented)

**Mock Data**:
- 4 sections
- 2-3 topics per section
- Sample replies

**Future Implementation**:
- Create new topics
- Post replies
- Edit/delete own posts
- Moderation (pin, lock, delete)
- Search topics
- Subscribe to topics
- Notifications for replies
- Rich text editor
- Attach images/links
- User reputation/badges

---

### 3.2 Event Chats Tab

#### Features
- **Event-based group chats**:
  - Chat rooms for each event
  - Attendees can join automatically
  - Event info in chat header
- **Chat list**:
  - Event name
  - Last message
  - Participant count
  - Event date/location
- **Group chat view**:
  - Multiple participants
  - System messages (user joined, etc.)
  - Message sending
  - Event details link

**Mock Data**: 1 group chat for "AloeVera Fest 2024"

**Future Implementation**:
- Auto-join when registering for event
- Leave chat
- Mute notifications
- See participant list
- Event organizer badge
- Share event in chat
- Polls for meetup locations

---

## 🎸 4. AloeVera (Band Hub)

**Route**: `/aloevera`  
**Component**: `src/pages/AloeVera.tsx`  
**Status**: Full mock UI with tabs

### 4.1 Events Tab

#### Features
- **Event cards** with:
  - Hero image (full width, 12rem height)
  - Event title and description
  - Event category badge (Concert, Meetup, Festival, Party, Yachting)
  - Price (if applicable)
  - Date and time
  - Location
  - Attendee count / capacity
  - Artistic postmark badge
  - Join/Joined button
- **Event categories**:
  - 🎤 **Concert** (Концерт) - Official band concerts
  - 🤝 **Meetup** (Встреча) - Fan meetups
  - 🎉 **Festival** (Фестиваль) - Multi-day festivals
  - 🎊 **Party** (Вечеринка) - Dance parties
  - ⛵ **Yachting** (Яхтинг) - Exclusive luxury events
- **Secret events**: Only visible to certain users (e.g., VIP members)

**Mock Events**:
1. "Концерт AloeVera: Новые горизонты" - Dec 15, Moscow, 500 capacity, 2500₽
2. "Фан-встреча: Поэзия и музыка" - Nov 8, Moscow, meetup
3. "AloeVera Fest 2024" - Jun 20-21, Luzhniki, 50k capacity, 5000₽
4. **SECRET**: "Яхтинг в Австралии 2026" - April 15-22, Australia, 50 capacity, 25000₽

**Interaction**:
- Click card → navigate to event details page
- Click Join/Joined → toggle attendance
- Joined events tracked locally

**Future Implementation**:
- Event filtering (date, location, category)
- Event search
- Calendar view
- Add to Google Calendar
- Ticket purchasing integration
- Waitlist for sold-out events
- Friend attendance visibility
- Event reminders
- QR code tickets

---

### 4.2 Event Details Page

**Route**: `/aloevera/events/:eventId`  
**Component**: `src/pages/EventDetails.tsx`

#### Features
- Full event information
- Attendee list with avatars
- Event description (expanded)
- Organizer information
- Map/directions (placeholder)
- Share event button
- Back navigation

**Future**:
- RSVP with +1
- Invite friends
- Event updates/announcements
- Photo gallery from past events
- Similar events suggestions

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
