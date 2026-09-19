# Chaos — services, data, flags

Use `make off` / `make down services=…`, Toxiproxy, or pause containers. App should degrade, not wedge.

## Process down

- **CHAOS-01** Stop `payment-service` during demo checkout: user sees an error; books stock is consistent (no unpaid reserve leak, or it is documented).
- **CHAOS-02** Stop `books-service`: GraphQL and store pages fail; auth/login still works.
- **CHAOS-03** Stop `sales-service`: catalog works; checkout/orders fail cleanly.
- **CHAOS-03a** Stop `cart-service`: catalog works; Add to cart / `/cart` fail cleanly; `POST /checkout` buy-now still works.
- **CHAOS-04** Stop `api-key-service`: partner search fails validation; shop JWT catalog still works.
- **CHAOS-05** Stop `user-service`: `/me` and admin users fail; GraphQL frontpage still works.
- **CHAOS-06** Stop `auth-service`: new login fails; already-issued access tokens still work until expiry.
- **CHAOS-07** Stop Kong while `API_GATEWAY_URL` is set: UI APIs fail; unsetting URL + Vite restart restores direct ports.
- **CHAOS-08** Stop Unleash: flags use last in-memory state / defaults; env overrides still apply. Restart backends if OTel must turn off.

## Datastores

- **CHAOS-09** Pause Postgres: all services 5xx/timeout; no half-written orders after resume (or document dirty state).
- **CHAOS-10** Stop Elasticsearch with search flag on: `searchBooks` falls back to Postgres; createBook still succeeds.
- **CHAOS-11** Stop Filebeat/Kibana: app traffic unaffected.
- **CHAOS-12** Stop otel-collector with `OTEL_ENABLED=true`: app stays up (export drops); no request 5xx from exporter.

## Latency / partitions

- **CHAOS-13** Delay books-service 2s: checkout/search p95 rises; Jaeger shows the slow span when OTel is on.
- **CHAOS-14** Delay api-key-service: Kong GraphQL with API key 401/timeout vs Yoga error — assert timeout bounds.

## Flags and config

- **CHAOS-15** Flip `search.elasticsearch` during a load run: no crash; mixed latency OK.
- **CHAOS-16** Flip `OTEL_ENABLED` without restart: export may stay as at boot (documented); with restart, traces start/stop.
- **CHAOS-17** Seed while ES is down, then `make up services=elasticsearch`: `rwa-books` backfills from Postgres within ~15s.
