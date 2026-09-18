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

| App | URL | Started by |
| --- | --- | --- |
| Public site | http://localhost:3000 | `pnpm dev:frontend` |
| Admin console | http://localhost:3004 | `pnpm dev:frontend` |
| GraphQL playground | http://localhost:3006/graphql | `make up` |
| Unleash (flags) | http://localhost:4242 | `make up` |
| OpenPanel (analytics) | http://localhost:3350 | `make up services=openpanel` |
| Elasticsearch | http://localhost:9200 | `make up services=elasticsearch` |
| Kibana (search + logs) | http://localhost:5601 | `make up services=elasticsearch` |

`pnpm dev` starts frontends and backends on the host. Do not run it together with `make up` — the ports clash. Host backends only: `pnpm dev:backend`.

## Docker backends

Each backend has its own Dockerfile under `backend/<name>/`. Drive Compose with Make, not pnpm. `make help` lists every target.

`make up` builds images and starts every **app backend plus Unleash**. OpenPanel and Elasticsearch stay off until you pass `services=`. `make down` stops the same set as `make up` and leaves Postgres running. Stop optional stacks with `make down services=openpanel` or `make down services=elasticsearch`.

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

Short names: `auth`, `user`, `books`, `sales`, `payment`, `api-key`, `unleash`, `openpanel`, `elasticsearch`. Commas may have spaces (`services=user, payment, books`). Full names like `user-service` work too.

Flags only: `make up services=unleash`. UI is http://localhost:4242 (`admin` / `unleash4all`). Frontend and backend examples: [docs/unleash.md](docs/unleash.md).

Analytics: `make up services=openpanel`. Dashboard is http://localhost:3350. Gated by Unleash `analytics.openpanel` or `VITE_OPENPANEL_ENABLED`. See [docs/openpanel.md](docs/openpanel.md).

Search and logs: `make up services=elasticsearch`. Filebeat ships Docker logs to Kibana (http://localhost:5601). books-service copies the Postgres catalog into `rwa-books` once Elasticsearch is up. `searchBooks` uses that index only when Unleash `search.elasticsearch` (or `ELASTICSEARCH_SEARCH_ENABLED`) is on. See [docs/elasticsearch.md](docs/elasticsearch.md).

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

**Packages:** `packages/db` (Prisma), `packages/shared` (types, flag helpers), `packages/service-kit` (JWT, CORS, internal HTTP, Elasticsearch client), `packages/app-client` (Unleash + OpenPanel for the Vite apps).

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

Partner search (replace the key from seed output). Elasticsearch full-text search is used when `search.elasticsearch` is on; otherwise Postgres `contains`:

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

[Unleash](https://www.getunleash.io/) runs next to the backends. Create a toggle in the UI, then evaluate it in React (`useFlag`) or Node (`isEnabled`). Copy-paste examples: [docs/unleash.md](docs/unleash.md).

OpenPanel tracking uses the live flag `analytics.openpanel`. The same feature can be forced on or off with `VITE_OPENPANEL_ENABLED`. See [docs/openpanel.md](docs/openpanel.md).

Book search uses Elasticsearch only when `search.elasticsearch` is on (or `ELASTICSEARCH_SEARCH_ENABLED`). See [docs/elasticsearch.md](docs/elasticsearch.md).

## Optional config

Host Prisma and Vite read `.env` (`localhost`, Postgres **5433**). Compose overrides database and service URLs inside containers.

Set Google and Stripe keys in `.env` when you want those integrations. See `.env.example`.

Public sign-in and sign-up use self-hosted [Altcha](https://altcha.org) proof-of-work. Admin login, GraphQL, and REST do not. After **5 failed passwords** for a username+IP (15 minutes), sign-in switches from invisible PoW to a checkbox.
