# API — Gateway (Kong `:8080`, optional)

Enable with `make up services=gateway`. Compare the same call on the service port vs Kong.

## Routing

- **API-GW-01** `POST http://localhost:8080/graphql` frontpage → same shape as `:3006`.
- **API-GW-02** `/auth/oauth/providers` → auth-service.
- **API-GW-03** `/me` vs `/me/orders` vs `/me/keys` vs `/me/store` hit user / sales / api-key / books respectively.
- **API-GW-04** `/internal/reindex` and `/internal/validate` on `:8080` → 404 (not routed).
- **API-GW-05** `/config` and `/api/stripe/webhook` are reachable without JWT.
- **API-GW-05a** `GET /cart` and `POST /cart/items` without JWT are allowed; invalid JWT on `/cart` → 401.

## Auth at the edge

- **API-GW-06** `/me` with no token → 401 `{ code: token_invalid }` from Kong (not the service).
- **API-GW-07** `/me` with malformed JWT → 401 Invalid token.
- **API-GW-08** `/me` with `X-Api-Key` only → 401 “API keys can only search books”.
- **API-GW-09** GraphQL with no credential → 200 (anonymous allowed).
- **API-GW-10** GraphQL with bad `X-Api-Key` → 401 before Yoga.
- **API-GW-11** GraphQL with valid access JWT → proxied; invalid JWT → 401.
- **API-GW-12** `OPTIONS` preflight is not blocked by JWT checks.

## Rate limits (per IP)

- **API-GW-13** Burst `/auth` above 10/sec or 40/min → 429 and `X-RateLimit-*` / `RateLimit-*`.
- **API-GW-14** Burst `/graphql` above 20/sec or 120/min → 429.
- **API-GW-15** Stripe path allows a higher ceiling (30/s, 300/min) than `/auth`.
- **API-GW-16** 429 does not take down other routes for a different path’s remaining quota if limits are per-route (assert actual).
