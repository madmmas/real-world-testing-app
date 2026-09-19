# Contract — GraphQL, REST, internal

Treat the running app (or a checked-in schema dump you generate) as the provider. Consumer tests live in the other repo.

## GraphQL (`books-service`)

- **CTR-GQL-01** Schema contains `frontpage`, `searchBooks`, `book`, `myBooks`, `adminBooks`, `createBook`, `updateBook`, `adminUpdateBook` and `BookCategory` enum of nine values.
- **CTR-GQL-02** `Book` fields: id, isbn, title, author, description, coverUrl, priceCents, stock, status, category, store { id name slug stripeOnboarded }.
- **CTR-GQL-03** Error extensions use `UNAUTHENTICATED` / `FORBIDDEN` as in current resolvers.
- **CTR-GQL-04** Partner-only operation remains `searchBooks` (no new root fields without updating this contract).

## REST (public/admin)

- **CTR-REST-01** Auth token JSON: `accessToken`, `refreshToken`, `tokenType`, `expiresIn`, `expiresAt`, `user`.
- **CTR-REST-02** Error body for JWT middleware: `{ error, code }` with `token_invalid` | `token_expired`.
- **CTR-REST-03** Kong 401 JSON: `code` `token_invalid` | `token_expired` as in `access.lua`.
- **CTR-REST-04** `GET /config` → `stripeEnabled` boolean, `checkoutMode` `stripe`|`demo`.
- **CTR-REST-05** Checkout response includes `checkoutUrl` (nullable in demo).
- **CTR-REST-05a** `GET /cart` includes `items`, `itemCount`, `totalCents`, `expiresAt`.
- **CTR-REST-06** Admin list payloads stay backward compatible for the admin UI (users, stores, orders, stats).
- **CTR-REST-07** `docs/openapi.yaml` (from `pnpm openapi:dump`) lists the public REST bodies; live 400 messages match Zod `error` strings for missing fields.

## Internal

- **CTR-INT-01** `x-internal-secret` header name is stable; 401 if missing/wrong.
- **CTR-INT-02** Reserve / fulfill / reindex / validate / cart-clear request+response shapes used by sales, payment, cart, seed, and Kong auth lua.

## Flags / env names

- **CTR-FLG-01** Flag strings stay `analytics.openpanel`, `search.elasticsearch`, `observability.opentelemetry`.
- **CTR-FLG-02** Env overrides: `VITE_OPENPANEL_ENABLED`, `ELASTICSEARCH_SEARCH_ENABLED`, `OTEL_ENABLED` with true/1/yes/on and false/0/no/off.
