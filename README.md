# Books Library

A local book marketplace. Buyers browse and check out on the public site; shops list inventory; admins use a separate console. The catalog is GraphQL. Everything else is REST.

## Quick start

You need Node 22+, pnpm, Docker, and Make. Postgres is published on **5433** so it does not collide with a database on 5432.

Backends run in Docker. Frontends run on the host.

```bash
cp .env.example .env
pnpm install
make db
pnpm db:setup
make up
pnpm dev:frontend
```

| App | URL |
| --- | --- |
| Public site | http://localhost:3000 |
| Admin console | http://localhost:3004 |
| GraphQL playground | http://localhost:3006/graphql |
| Unleash (flags) | http://localhost:4242 |

`pnpm dev` starts frontends and backends on the host. Do not run it together with `make up` — the ports clash. Host backends only: `pnpm dev:backend`.

## Docker backends

Each backend has its own Dockerfile under `backend/<name>/`. Drive Compose with Make, not pnpm. `make help` lists every target.

`make up` builds images and starts every backend. Add `services=` to touch only some of them. Stopping app services leaves Postgres running.

| Goal | Command |
| --- | --- |
| Start all | `make up` |
| Start some | `make up services=user,payment,books` |
| Start, skip rebuild | `make on services=auth,books` |
| Stop all (keep Postgres) | `make down` |
| Stop some | `make down services=payment` |
| Restart | `make restart services=user` |
| Logs | `make logs` or `make logs services=books` |
| Rebuild | `make build` or `make build services=auth` |
| Status | `make ps` |
| Postgres only | `make db` |

Short names: `auth`, `user`, `books`, `sales`, `payment`, `api-key`, `unleash`. Commas may have spaces (`services=user, payment, books`). Full names like `user-service` work too.

Flags only: `make up services=unleash`. UI is http://localhost:4242 (`admin` / `unleash4all`). Frontend and backend examples: [docs/unleash.md](docs/unleash.md).

## Demo accounts

`pnpm db:setup` (and `pnpm db:seed`) create these. Password for every account: **Passw0rd!**

| Username | Where |
| --- | --- |
| `buyer` | Public site |
| `superadmin` | Admin console (all sections) |
| `sales` | Admin console (users, stores, orders) |
| `marketing` | Admin console (books) |

Shop usernames and the demo partner API key are printed when seed finishes.

## Repo layout

**Frontend**

- `frontend/web` — public site (port 3000)
- `frontend/admin` — admin console (port 3004)

**Backend**

| Short name | What it does | Port |
| --- | --- | --- |
| `auth` | Session, JWT, Google OAuth | 3003 |
| `user` | Profiles and admin users | 3005 |
| `books` | GraphQL catalog plus REST stores | 3006 |
| `sales` | Checkout and orders | 3007 |
| `payment` | Stripe checkout and webhooks | 3008 |
| `api-key` | Partner API keys | 3009 |

**Packages:** `packages/db` (Prisma), `packages/shared` (types), `packages/service-kit` (JWT, CORS, internal HTTP).

## Auth

Public site:

| Who | Sign-in | Can |
| --- | --- | --- |
| Anonymous | — | Browse and search |
| User | JWT or Google | Buy, orders, account |
| Shop | JWT | Sell, store, partner keys, and everything a user can |
| API key | `X-Api-Key` | `searchBooks` only |

Admin console (session cookie `rwa.admin.sid`, then a JWT for APIs):

| Role | Access |
| --- | --- |
| Superadmin | Users, stores, books, orders |
| Sales | Users (user ↔ shop only), stores, orders |
| Marketing | Books |

Admin accounts cannot use public JWT login.

Access tokens last 15 minutes. Refresh tokens live in sessionStorage on the public site, rotate on every use, and are stored as SHA-256 hashes.

## GraphQL

Only books-service serves GraphQL (`POST /graphql` on port 3006). Auth, users, stores, orders, payments, and API keys are REST.

Partner search (replace the key from seed output):

```bash
curl -s http://localhost:3006/graphql \
  -H "Content-Type: application/json" \
  -H "X-Api-Key: rwa_live_..." \
  -d '{"query":"{ searchBooks(q: \"ocean\", limit: 5) { title author category store { name } } }"}'
```

Frontpage, no key:

```bash
curl -s http://localhost:3006/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ frontpage { category books { title } } }"}'
```

## Payments

Stripe Connect destination charges with a platform fee (`PLATFORM_FEE_BPS`, default 10%). Sellers onboard from **Store**. If `STRIPE_SECRET_KEY` is unset, checkout still records a paid order locally.

Webhook: `POST http://localhost:3008/api/stripe/webhook`.

## Feature flags

[Unleash](https://www.getunleash.io/) runs next to the backends. Create a toggle in the UI, then evaluate it in React (`useFlag`) or Node (`isEnabled`). Copy-paste examples for this repo: [docs/unleash.md](docs/unleash.md).

## Optional config

Host Prisma and Vite read `.env` (`localhost`, Postgres **5433**). Compose overrides database and service URLs inside containers.

Set Google and Stripe keys in `.env` when you want those integrations. See `.env.example`.

Public sign-in and sign-up use self-hosted [Altcha](https://altcha.org) proof-of-work. Admin login, GraphQL, and REST do not. After **5 failed passwords** for a username+IP (15 minutes), sign-in switches from invisible PoW to a checkbox.
