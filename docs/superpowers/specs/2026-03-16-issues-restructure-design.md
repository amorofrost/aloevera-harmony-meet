# Design Spec: ISSUES.md Restructure + Missing Features Audit

**Date**: 2026-03-16
**Status**: Pending user review
**Scope**: Restructure `docs/ISSUES.md` into clean type-based sections, archive resolved issues to `docs/RESOLVED_ISSUES.md`, and add newly identified missing features and infrastructure gaps.

---

## Problem

`ISSUES.md` currently groups issues only by severity (Critical / High / Medium / Low), mixing resolved items, product feature gaps, tech debt, and polish concerns in the same buckets. As the issue count grows this becomes hard to navigate. Resolved issues (9 of 25) pollute the active list.

---

## Solution

Restructure `ISSUES.md` into type-based sections. Move all resolved issues to a new `RESOLVED_ISSUES.md` file. Add newly audited issues across product and infrastructure dimensions.

---

## File Changes

### `docs/ISSUES.md` — rewritten

Sections (in order):

1. **🔴 Production Blockers** — must fix before real users
2. **🟠 Missing Core Features** — product gaps breaking or significantly limiting core user journeys
3. **🟡 Technical Debt & Infrastructure** — code quality, DevOps, security hardening
4. **🟢 UX / Polish** — low-urgency improvements
5. **📊 Summary table** — counts per section
6. **📝 Changelog** — dated update notes

A link to `docs/RESOLVED_ISSUES.md` is included at the top of `ISSUES.md` for historical context.

The existing "Recommended Priority Order" section is removed — the section structure itself communicates priority (top section = highest priority). Issues within each section are ordered by urgency.

### `docs/RESOLVED_ISSUES.md` — new file

- Links back to `docs/ISSUES.md`
- Contains all previously resolved issues (#1, #2, #3, #5, #6, #7, #9, #10, #17)
- **Format**: each resolved issue retains its full original content (description, what was implemented, remaining gaps) — no detail is lost
- Append-only going forward: issues move here when resolved, never deleted

### `AGENTS.md` — update required

- Line referencing `docs/ISSUES.md` as "complete list" must be updated to also reference `docs/RESOLVED_ISSUES.md`
- Directory listing in the docs section must include `RESOLVED_ISSUES.md`

---

## Issue Inventory

### 🔴 Production Blockers (new issues #26–#30)

These are issues that must be resolved before the app serves real users.

| # | Title | Description |
|---|---|---|
| #26 | Email service missing | Verification tokens logged to console only. Email verification and password reset are non-functional. Account recovery is impossible without this — users who lose their password have no recourse. Required at launch because `registerSchema` enforces a valid email address, implying email is a first-class identity. Requires SMTP/SendGrid integration in the backend. |
| #27 | No HTTPS on Azure VM | JWT tokens and credentials travel in plaintext over HTTP. `localStorage` tokens are readable in transit. Requires SSL certificate and nginx TLS configuration. |
| #28 | No rate limiting on auth endpoints | Brute-force login and registration attacks are completely unprotected. Requires rate limiting middleware on `/api/v1/auth/*` endpoints. |
| #29 | No account lockout | Unlimited failed login attempts with no lockout or delay. Requires failed-attempt tracking and temporary account lockout in `MockAuthService` / `AzureAuthService`. |
| #30 | No input sanitization on user content | Forum replies, chat messages, and bio fields are stored and rendered without sanitisation. While React escapes plain string output by default, this becomes a direct XSS vector when rich text rendering is introduced (#40). Server-side sanitisation should be implemented now, before rich text support is added, to avoid retrofitting. |

### 🟠 Missing Core Features (new issues #31–#46; escalated #15)

| # | Title | Description |
|---|---|---|
| #15 *(escalated)* | Desktop navigation | Bottom navigation is mobile-only (`hidden md:flex` or equivalent). No navigation exists on desktop viewports — the app is functionally unusable on large screens. Previously tracked as Medium UX issue; escalated to Missing Core Feature given it blocks a full class of users. |
| #31 | Forum topic creation | Users can only reply to existing topics. There is no `createTopic` endpoint in the backend, no `forumsApi.createTopic()` in the frontend, and no UI. The community feature is read-only for new content. |
| #32 | Profile image upload | Profile images are hardcoded Unsplash URLs. Azure Blob Storage is not integrated. Users cannot set their own photo. |
| #33 | Notification system | No real-time or push notifications of any kind. Users receive no alerts for new matches, received likes, or replies to their forum posts. |
| #34 | Songs backend endpoint | `songsApi.ts` is mock-only. Favorite songs displayed on profiles are disconnected from any real data. Backend has no songs endpoint. |
| #35 | Pagination on list views | All list views (users, events, blog, forum topics) load full datasets at once. No infinite scroll or page controls. Will degrade at scale. |
| #36 | Advanced user search & filtering | User discovery has no active filters. Preferences (age range, gender, location) exist in the data model but are not wired to the matching algorithm. Required filters: location (country/city) and event attendance. |
| #37 | Anonymous likes | Blind-match mode: a user can send an anonymous like that is stored in the system but the sender's identity is not revealed to the recipient until they also send a like back, at which point a match is created and is no longer anonymous. |
| #38 | Event sub-groups | Groups (e.g. boats for a yachting event) within a parent event, each with their own forum topic and user roster. All attendees of the parent event can see and interact across sub-groups regardless of their own assignment. Requires backend sub-group model and UI in `EventDetails.tsx`. |
| #39 | Gated registration via access codes | When enabled by an admin, only users with a valid access code can register. Codes are time-limited and distributed at real-world events (QR codes or short keywords). Managed via admin panel (#45). |
| #40 | Rich text and media in forum & chat | Forum posts and direct messages support basic text formatting (bold, italic, lists) and image attachments. Requires a rich text editor component on the frontend and media upload support on the backend. Directly impacts input sanitisation (#30). |
| #41 | Ranking & badges system | Community activity-based user ranks displayed on profiles. Example tiers: Novice → Active Member → Friend of Aloe → Aloe Crew. Criteria: forum post count, match/friend count, likes received, events attended. |
| #42 | Event group chat (real implementation) | Event discussions in `Talks.tsx` currently route through a forum topic as a workaround. Requires a proper multi-participant group chat per event using the SignalR `ChatHub`, replacing the current bridge. |
| #43 | Public metrics dashboard | Basic platform stats visible to all users: total registered users, users currently online, recent registration activity. |
| #44 | AI content moderation | Automated detection of spam and inappropriate content on forum posts, replies, and chat messages. Flagged content routed to admin panel (#45) for human review. |
| #45 | Admin & moderator panel | Dedicated interface for: toggling app feature flags, blocking/unblocking user accounts, deleting forum content, managing access codes (#39), reviewing AI moderation flags (#44), viewing platform metrics. Potentially a separate web application for security isolation from the main frontend. |
| #46 | Telegram Mini App | Second client targeting users who prefer to stay in Telegram. Planned as a separate repository (`@aloevera-telegram-bot/`). Uses the same LoveCraft backend API. Requires Telegram bot authentication on the backend (see `AUTHENTICATION.md`). *Note: significant scope — separate project.* |
| #47 | aloeband.ru scraper | Automated scraper that pulls upcoming concerts, events, and store items from the official band website. App events and store items include a forward link to the official site for ticket/merchandise purchases. *Note: significant scope — integration project.* |

### 🟡 Technical Debt & Infrastructure (re-filed #4, #8, #12 + new #48–#51)

| # | Title | Note |
|---|---|---|
| #4 | Loose TypeScript configuration | Existing — `strictNullChecks: false`, `noImplicitAny: false` |
| #8 | Incomplete i18n | Existing — many strings hardcoded in Russian |
| #12 | No global state management strategy | Existing — TanStack Query configured but unused |
| #48 | No React Error Boundaries | Component crashes take down the entire app. No fallback UI. |
| #49 | No structured logging / monitoring | No Application Insights, no Serilog output in production. Impossible to diagnose issues post-deployment. |
| #50 | No CI/CD pipeline | No automated test runs on push. No automated deployment. Fully manual Docker builds on the Azure VM. |
| #51 | `localStorage` token security | Access token should move to memory (React state/context); refresh token to HttpOnly cookie. Backend already supports the cookie flow conditionally on `Request.IsHttps`. Blocked on #27 (HTTPS). |

### 🟢 UX / Polish (re-filed existing; #15 escalated out of this section)

Re-filed without changes: `#11` Accessibility, `#13` Swipe UX, `#14` Image handling, `#16` package.json name, `#18` Env config, `#19` Unused dependencies, `#20` Analytics, `#21` PWA, `#22` Date formatting, `#23` SEO metadata, `#24` Content moderation UI placeholder, `#25` Event Postmark. *(#15 Responsive design moved to Missing Core Features as escalated desktop navigation issue.)*

---

## Resolved Issues Archive

The following issues are resolved and move to `docs/RESOLVED_ISSUES.md` with their full original content preserved:

| # | Title | Resolved |
|---|---|---|
| #1 | Pages not connected to backend | Feb 19, 2026 |
| #2 | AuthContext / token storage | Feb 19 + Feb 24, 2026 |
| #3 | No data persistence / Azure Storage | Feb 23, 2026 |
| #5 | No testing framework | Mar 15, 2026 (50 tests: Vitest + RTL) |
| #6 | Mock data embedded in components | Feb 19, 2026 |
| #7 | Duplicate Message interface | Mar 15, 2026 |
| #9 | No user-visible error handling | Mar 14, 2026 |
| #10 | No form validation | Mar 14, 2026 |
| #17 | Docker configuration incomplete | Feb 23, 2026 |

---

## Summary Table (target state)

| Section | Count |
|---|---|
| 🔴 Production Blockers | 5 |
| 🟠 Missing Core Features | 18 (17 new + escalated #15) |
| 🟡 Technical Debt & Infrastructure | 7 |
| 🟢 UX / Polish | 12 |
| **Total active** | **42** |
| ✅ Resolved (archived) | 9 |
