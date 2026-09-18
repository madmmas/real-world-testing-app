# Kong API Gateway

Public API traffic for the six app backends. Unleash, OpenPanel, Elasticsearch, and Kibana stay on their own ports (operator UIs, not product APIs). Service-to-service calls still use Docker DNS and `x-internal-secret`. `/internal/*` is not routed.

| | |
| --- | --- |
| Proxy | http://localhost:8080 |
| Image | `kong:3.9` (OSS, DB-less) |
| Rate limit | per IP, in-memory (`policy: local`) |
| Enable | `make up services=gateway` plus `API_GATEWAY_URL` |
| Auth | Access JWT, or `X-Api-Key` on GraphQL |

`make up` does not start Kong.

## Why Kong

Compared with other OSS gateways for this local Compose repo:

| Gateway | Why not (here) |
| --- | --- |
| Apache APISIX | Needs etcd |
| Tyk | Needs Redis and more moving parts |
| KrakenD | Stateless and fine, but weaker “API gateway” plugin story |
| Traefik / Caddy | Reverse proxies; this repo already uses Caddy for OpenPanel |

Kong OSS is one container, a git-friendly `kong.yml`, and a built-in rate-limiting plugin. DB-less mode skips a second Postgres.

## Start

```bash
make up services=gateway
```

That starts Kong and, if they are not already up, the six backends it proxies. Set this in repo-root `.env` so Vite sends browser calls through Kong (restart `pnpm dev:frontend` after):

```
API_GATEWAY_URL=http://localhost:8080
```

Unset `API_GATEWAY_URL` (or comment it out) to talk to service ports again. Stop Kong with `make down services=gateway`. Docker nginx uses `NGINX_GATEWAY=http://kong:8000` instead of `API_GATEWAY_URL` ([docs/frontend.md](frontend.md)).

## Routes

Longest prefix wins (`/me/orders` is sales, `/me` is user). Host ports `3003`/`3005`–`3009` stay published for debugging; with `API_GATEWAY_URL` set the UIs do not use them.

| Path | Upstream |
| --- | --- |
| `/auth` | auth-service |
| `/graphql` | books-service |
| `/me/store`, `/me/stripe`, `/admin/stores` | books-service |
| `/me/orders`, `/me/sales`, `/checkout`, `/admin/orders` | sales-service |
| `/me/keys` | api-key-service |
| `/me`, `/admin/users`, `/admin/me`, `/admin/stats` | user-service |
| `/config`, `/api/stripe` | payment-service |

Admin Vite still rewrites `/api/admin/...` to `/admin/...` before the proxy.

## Auth (JWT or API key)

When Kong is up it checks credentials **before** the backends. `/auth`, `/config`, and `/api/stripe` stay open (login, captcha, Stripe signature). CORS preflight (`OPTIONS`) is not checked.

| Traffic | Gateway check |
| --- | --- |
| `/graphql` with no credential | Allowed (frontpage / public search) |
| `/graphql` + `X-Api-Key` or `Bearer rwa_live_...` | Key is validated against api-key-service |
| `/graphql` + access JWT | JWT signature, `iss`, `aud`, `exp`, `typ=access` |
| `/me`, `/checkout`, `/admin`, … | Access JWT required (API keys cannot call these) |

Invalid or expired credentials return **401** with `code: token_invalid` or `token_expired`. Backends still enforce roles. Logic lives in `docker/kong/access.lua`.

## Rate limits

Per client IP. Kong returns **429** and `X-RateLimit-*` headers.

| Traffic | Per second | Per minute |
| --- | --- | --- |
| `/auth` | 10 | 40 |
| Stripe webhook `/api/stripe` | 30 | 300 |
| Everything else on the gateway | 20 | 120 |

Limits live in `docker/kong/kong.yml`. `policy: local` is correct for a single node (no Redis).

## Try it

```bash
curl -s http://localhost:8080/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ frontpage { category books { title } } }"}'

curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/me
# 401 without a JWT
```

Stripe webhook when the gateway is on: `POST http://localhost:8080/api/stripe/webhook`.
