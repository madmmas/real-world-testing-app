# Books Library

A local book marketplace. Buyers browse and check out on the public site; shops list inventory; admins use a separate console. The catalog is GraphQL. Everything else is REST.

## Quick start

You need Node 22+, pnpm, Docker, and Make. Postgres is published on **5433** so it does not collide with a database on 5432.

Backends and the nginx UIs run in Docker. Use `pnpm dev:frontend` only when you want Vite HMR instead of nginx (stop the frontend container first).

```bash
cp .env.example .env
pnpm install
make db
pnpm db:setup
make up
```

| App | URL | Started by |
| --- | --- | --- |
| Public site | https://localhost:3000 | `make up` |
| Admin console | https://localhost:3004 | `make up` |
| GraphQL playground | http://localhost:3006/graphql | `make up` |
| Unleash (flags) | http://localhost:4242 | `make up` |
| MinIO console | http://localhost:9001 | `make up` |
| MinIO API | http://localhost:9000 | `make up` |
| Mailpit | http://localhost:8025 | `make up` |
| OpenPanel (analytics) | http://localhost:3350 | `make up services=openpanel` |
| Elasticsearch | http://localhost:9200 | `make up services=elasticsearch` |
| Kibana (search + logs) | http://localhost:5601 | `make up services=elasticsearch` |
| API gateway (Kong) | http://localhost:8080 | `make up services=gateway` |
| Grafana (perf) | http://localhost:3001 | `make up services=observability` |
| Jaeger (traces) | http://localhost:16686 | `make up services=observability` |
| Prometheus | http://localhost:9090 | `make up services=observability` |

`pnpm dev` (same as `pnpm dev:frontend`) starts Vite on the host. Stop nginx first (`make down services=frontend`) so ports 3000 and 3004 are free. Backends run with Make and Docker, not pnpm.

## Docker backends

Each backend has its own Dockerfile under `backend/<name>/`. Drive Compose with Make, not pnpm. `make help` lists every target.

`make up` builds images and starts **Postgres, the six app backends, Unleash, MinIO, Mailpit, and nginx** (HTTPS on :3000 and :3004). OpenPanel, Elasticsearch, Kong, and observability stay off until you pass `services=` or run `make up all`. `make down` stops that same set and leaves Postgres running. `make down all` also stops the optional stacks (still leaves Postgres).

| Goal | Command |
| --- | --- |
| Start db + backends + nginx + MinIO | `make up` |
| Start everything | `make up all` |
| Start some | `make up services=user,payment,books` |
| Start, skip rebuild | `make on services=auth,books` |
| Stop backends + nginx (keep Postgres) | `make down` |
| Stop backends + optional stacks | `make down all` |
| Stop some | `make down services=payment` |
| Restart | `make restart services=user` |
| Logs | `make logs` or `make logs services=books` |
| Rebuild | `make build` or `make build services=auth` |
| Status | `make ps` |
| Postgres only | `make db` |

Short names: `auth`, `user`, `books`, `sales`, `payment`, `api-key`, `unleash`, `openpanel`, `elasticsearch`, `gateway`, `observability`, `frontend`, `minio`, `mail`. Commas may have spaces (`services=user, payment, books`). Full names like `user-service` work too.

Flags only: `make up services=unleash`. UI is http://localhost:4242 (`admin` / `unleash4all`). Frontend and backend examples: [docs/unleash.md](docs/unleash.md).

Analytics: `make up services=openpanel`. Dashboard is http://localhost:3350. Gated by Unleash `analytics.openpanel` or `VITE_OPENPANEL_ENABLED`. See [docs/openpanel.md](docs/openpanel.md).

Search and logs: `make up services=elasticsearch`. Filebeat ships Docker logs to Kibana (http://localhost:5601). books-service copies the Postgres catalog into `rwa-books` once Elasticsearch is up. `searchBooks` uses that index only when Unleash `search.elasticsearch` (or `ELASTICSEARCH_SEARCH_ENABLED`) is on. See [docs/elasticsearch.md](docs/elasticsearch.md).

API gateway: `make up services=gateway`. Kong sits in front of the six app APIs on http://localhost:8080 with per-IP rate limits and checks access JWTs (or a partner API key on GraphQL). Set `API_GATEWAY_URL=http://localhost:8080` so the Vite apps proxy through it. See [docs/gateway.md](docs/gateway.md).

Performance: `make up services=observability`. Grafana is http://localhost:3001, Jaeger http://localhost:16686. OpenTelemetry export is off until Unleash `observability.opentelemetry` (or `OTEL_ENABLED`) is on; restart backends after toggling. See [docs/observability.md](docs/observability.md).

Frontends: `make up` starts nginx with HTTPS (self-signed localhost cert). Vite HMR is `pnpm dev:frontend` after `make down services=frontend`. See [docs/frontend.md](docs/frontend.md).

MinIO: S3 on http://localhost:9000; browser GET via https://localhost:3000/media/. See [docs/minio.md](docs/minio.md).

Password reset mail is caught by Mailpit (http://localhost:8025). See [docs/mail.md](docs/mail.md).

Public REST bodies are validated with Zod. Dump the OpenAPI file with `pnpm openapi:dump` ([docs/openapi.yaml](docs/openapi.yaml)). Superadmin audit log: [docs/audit.md](docs/audit.md). Postgres + MinIO backup drill: [docs/backup.md](docs/backup.md).

## Demo accounts

`pnpm db:setup` (and `pnpm db:seed`) create these. Password for every account: **Passw0rd!**

| Username | Where |
| --- | --- |
| `buyer` | Public site |
| `superadmin` | Admin console (all sections) |
| `sales` | Admin console (users, stores, orders) |
| `marketing` | Admin console (books) |

Shop usernames and the demo partner API key are printed when seed finishes.

Manual test scenarios (API, UI E2E, load, security, contract, chaos, accessibility) live in [tests/](tests/). They are not executed in this repo; implement them in a separate project.

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

Only books-service serves GraphQL (`POST /graphql` on port 3006, or http://localhost:8080/graphql when Kong is up). Auth, users, stores, orders, payments, and API keys are REST.

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

Webhook: `POST http://localhost:3008/api/stripe/webhook` (or `http://localhost:8080/api/stripe/webhook` through Kong).

## Feature flags

[Unleash](https://www.getunleash.io/) runs next to the backends. Create a toggle in the UI, then evaluate it in React (`useFlag`) or Node (`isEnabled`). Copy-paste examples: [docs/unleash.md](docs/unleash.md).

OpenPanel tracking uses the live flag `analytics.openpanel`. The same feature can be forced on or off with `VITE_OPENPANEL_ENABLED`. See [docs/openpanel.md](docs/openpanel.md).

Book search uses Elasticsearch only when `search.elasticsearch` is on (or `ELASTICSEARCH_SEARCH_ENABLED`). See [docs/elasticsearch.md](docs/elasticsearch.md).

Kong is the optional API gateway when `make up services=gateway` is on and `API_GATEWAY_URL` is set. See [docs/gateway.md](docs/gateway.md).

OpenTelemetry export uses `observability.opentelemetry` (or `OTEL_ENABLED`). Grafana / Jaeger / Prometheus: [docs/observability.md](docs/observability.md).

Password reset mail is local Mailpit only: [docs/mail.md](docs/mail.md).

REST request bodies: [docs/openapi.yaml](docs/openapi.yaml) (`pnpm openapi:dump`). Audit log: [docs/audit.md](docs/audit.md). Backup/restore: [docs/backup.md](docs/backup.md).

## Optional config

Host Prisma and Vite read `.env` (`localhost`, Postgres **5433**). Compose overrides database and service URLs inside containers. For nginx TLS, `WEB_ORIGIN` and `ADMIN_ORIGIN` should be `https://localhost:3000` and `https://localhost:3004` (see `.env.example`).

Set Google and Stripe keys in `.env` when you want those integrations. See `.env.example`.

Public sign-in and sign-up use self-hosted [Altcha](https://altcha.org) proof-of-work. Admin login, GraphQL, and REST do not. After **5 failed passwords** for a username+IP (15 minutes), sign-in switches from invisible PoW to a checkbox.
