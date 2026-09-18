# OpenPanel

Local product analytics (funnels, events, identify) for the public site and admin console. Tracking is **off** until the Unleash flag is on **or** the env override allows it, **and** a client id is set.

| | |
| --- | --- |
| Dashboard | http://localhost:3350 |
| Ingest API | http://localhost:3350/api |
| Unleash flag | `analytics.openpanel` |
| Env override | `VITE_OPENPANEL_ENABLED` |

OpenPanel is a separate Compose profile. `make up` does not start it (ClickHouse is heavy).

## Start

```bash
make up services=openpanel
```

Open http://localhost:3350, register a local user (`ALLOW_REGISTRATION` is on), create a project, then copy a **client id**.

Put it in the repo-root `.env` (Vite loads that file):

```
VITE_OPENPANEL_CLIENT_ID=your-client-id
VITE_OPENPANEL_API_URL=http://localhost:3350/api
```

Restart `pnpm dev:frontend` after changing `VITE_*`.

## Turn tracking on

**Unleash** (default): http://localhost:4242 (`admin` / `unleash4all`) → new toggle named `analytics.openpanel` → enable in **development**.

**Env** (same feature, no Unleash required):

| `VITE_OPENPANEL_ENABLED` | Result |
| --- | --- |
| `true` / `1` / `yes` / `on` | On even if the Unleash flag is off |
| `false` / `0` / `no` / `off` | Off even if the Unleash flag is on |
| unset | Unleash flag only |

Without a client id, the SDK stays silent even when the flag is on.

## What the frontends send

When the feature is allowed, `@openpanel/web` starts and page views are automatic. Custom events:

| Event | Where |
| --- | --- |
| `signup_completed` | Public sign-up |
| `login` | Public JWT login, admin session login |
| `oauth_google` | Public Google callback |
| `search` | Public search |
| `book_viewed` | Book detail |
| `checkout_started` | Buy |
| `checkout_completed` | `/orders?paid=1` (demo pay or Stripe return) |

Logged-in users are `identify`'d with id, name, email, username, and role. Logout calls `clear`.

Example funnel in the OpenPanel UI: `signup_completed` → `book_viewed` → `checkout_started` → `checkout_completed`.

## Code

| Piece | Path |
| --- | --- |
| Flag + env helper | `packages/shared/src/index.ts` (`featureAllowed`) |
| SDK wrapper | `packages/app-client/src/analytics.ts` |
| Runtime gate | `packages/app-client/src/AnalyticsRuntime.tsx` |
| Web / admin boot | `frontend/web/src/flags.tsx`, `frontend/admin/src/flags.tsx` |

`track()` is a no-op while the feature is off, so pages can call it unconditionally.
