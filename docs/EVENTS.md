# Events — product & frontend reference

This document summarizes **event-related behavior** in the AloeVera Harmony Meet web app and how it maps to the Lovecraft API. For full API and storage details, see the backend repository: **`Lovecraft/docs/EVENTS.md`** (in the `lovecraft` backend repo).

---

## User-facing behavior

### Visibility

- **Public** — Listed for everyone; full details and event forum topics (subject to per-topic rules below).
- **Secret teaser** — Card may appear with limited fields; full detail and deep links often require an **invite code** (`?code=` on the event URL or validated at registration).
- **Secret hidden** — Shown only to **attendees** and staff; others do not see it in lists.

### Interest vs attending

- **Interested** — User toggle; tracked separately from attendance. Does **not** unlock attendee-only forum topics.
- **Attending** — Requires **registering** with a valid **per-event invite code** (non-staff). Staff flows may omit the code where the API allows.

### Price and description

- **Price** is a **free-text string** from the API/admin (e.g. `"2500 ₽"`, `"from $100"`). The UI does **not** append a currency symbol automatically.
- **Description** may be **multi-line**; event detail and list cards use styles that preserve line breaks (`whitespace-pre-line`).

### External link

- Optional **official / tickets URL** on event detail when the API provides `externalUrl`.

### Forum (Talks → event discussions)

- Each event can have multiple **discussion topics** in the `events` forum section.
- Topics are **filtered** server-side: you only receive threads you are allowed to see.
- **Visibility modes** (per topic): **public** (anyone who can see the event discussion area), **attendees only**, or **specific users** (allow-list of user IDs). Moderators/admins see all.

### Admin (`/admin` → events)

- Create/edit events (including visibility, archive, price text, external URL, badge image).
- Manage **invite codes**, **attendees**, and **forum topics** for the event.
- For each forum topic: edit title/body and set **topic visibility** (public / attendees only / specific users) and **allowed user IDs** when using “specific users”.

---

## Frontend code map

| Area | Files / notes |
|------|----------------|
| Event list & cards | `src/pages/AloeVera.tsx`, `src/pages/Events.tsx` |
| Event detail | `src/pages/EventDetails.tsx` — price, description, external link, interest, invite |
| API types & mapping | `src/types/user.ts` (`Event`), `src/services/api/eventsApi.ts` |
| Forum / Talks | `src/pages/Talks.tsx`, `src/services/api/forumsApi.ts` |
| Admin | `src/admin/pages/AdminEventEditorPage.tsx`, `src/services/api/adminApi.ts` (`ForumTopicAdminDto`, `eventTopicVisibility`) |
| Mock data | `src/data/mockEvents.ts` |

---

## API surface (client)

- **Events:** `eventsApi` — list, get by id, register/unregister, interest, etc. (see `eventsApi.ts`).
- **Forum:** `forumsApi` — `event-discussions/summary`, `event-discussions/{eventId}/topics`, topic detail, replies.
- **Admin:** `adminApi` — `getForumTopics`, `createForumTopic`, `updateForumTopic` with `eventTopicVisibility` and `allowedUserIds` where applicable.

Ensure `VITE_API_MODE=api` when testing against a real backend (see [API_INTEGRATION.md](./API_INTEGRATION.md)).

---

## Related docs

- [FEATURES.md](./FEATURES.md) — broader product sections (may be partially updated; this file is the source of truth for **events**).
- [API_INTEGRATION.md](./API_INTEGRATION.md) — mock vs API mode.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — app structure.

---

*Last updated: 2026-04-18*
