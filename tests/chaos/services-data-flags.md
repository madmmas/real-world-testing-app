# Chaos — services, data, flags

Use `make off` / `make down services=…`, Toxiproxy, or pause containers. App should degrade, not wedge.

## Process down

- **CHAOS-01** Stop `payment-service` during demo checkout: user sees an error; the checkout saga compensates and inventory `release` restores reserved stock. Pending Stripe checkouts stay `awaiting_payment` and hold stock until fulfill (abandoned sessions do not auto-release).
- **CHAOS-01a** Kill `order-service` mid-checkout while the saga is `running`: on restart it compensates (stock released, unpaid orders cancelled). `awaiting_payment` sagas are not auto-compensated.
- **CHAOS-02** Stop `catalog-service`: GraphQL fails; store and keys still work; auth/login still works.
- **CHAOS-03** Stop `order-service`: catalog works; checkout, cart, and orders fail cleanly.
- **CHAOS-03a** Stop `inventory-service`: catalog browse works; Add to cart / checkout fail cleanly.
- **CHAOS-04** Stop `store-service`: partner search fails validation; `/me/store` and `/me/keys` fail; shop JWT catalog still works.
- **CHAOS-05** Stop `auth-service`: login, `/me`, and admin users fail; GraphQL frontpage still works. Already-issued access tokens still authorize catalog/order until expiry.
- **CHAOS-06** Restart `auth-service`: new login works; `/me` with a still-valid access token works without logging in again.
- **CHAOS-07** Stop Kong while `API_GATEWAY_URL` is set: UI APIs fail; unsetting URL + Vite restart restores direct ports.
- **CHAOS-08** Stop Unleash: flags use last in-memory state / defaults; env overrides still apply. Restart backends if OTel must turn off.

## Datastores

- **CHAOS-09** Pause Postgres: all services 5xx/timeout; no half-written orders after resume (or document dirty state).
- **CHAOS-10** Stop Elasticsearch with search flag on: `searchBooks` falls back to Postgres; createBook still succeeds.
- **CHAOS-11** Stop Filebeat/Kibana: app traffic unaffected.
- **CHAOS-12** Stop otel-collector with `OTEL_ENABLED=true`: app stays up (export drops); no request 5xx from exporter.

## Latency / partitions

- **CHAOS-13** Delay inventory-service 2s: checkout/cart p95 rises; delay catalog-service 2s: search p95 rises. Jaeger shows the slow span when OTel is on.
- **CHAOS-14** Delay store-service: Kong GraphQL with API key 401/timeout vs Yoga error — assert timeout bounds.

## Flags and config

- **CHAOS-15** Flip `search.elasticsearch` during a load run: no crash; mixed latency OK.
- **CHAOS-16** Flip `OTEL_ENABLED` without restart: export may stay as at boot (documented); with restart, traces start/stop.
- **CHAOS-17** Seed while ES is down, then `make up services=elasticsearch`: `rwa-books` backfills from Postgres within ~15s.
