# API — Catalog (`catalog-service`, port 3006)

GraphQL `POST /graphql`. Search may use Elasticsearch when `search.elasticsearch` or `ELASTICSEARCH_SEARCH_ENABLED` is on; otherwise Prisma `contains`. Store REST and partner keys live on `store-service` (`tests/api/stores.md`).

## GraphQL — anonymous / public JWT

- **API-BOOKS-01** `{ frontpage { category books { title } } }` with no auth → shelves only for categories that have listed in-stock books.
- **API-BOOKS-02** `{ searchBooks(q: "ocean") { title author } }` anonymous → listed books; empty q still returns a page.
- **API-BOOKS-03** `searchBooks` filters: `category`, `isbn`, `author`, `storeSlug`, `limit` (cap 50), `offset`.
- **API-BOOKS-04** `{ book(id) { ... } }` listed book → `coverUrl` starts with `/media/covers/` when MinIO is up (else Gutenberg); unknown id → null.
- **API-BOOKS-05** `myBooks` / `createBook` / `updateBook` / `adminBooks` / `adminUpdateBook` without JWT → GraphQL `UNAUTHENTICATED`.
- **API-BOOKS-06** Buyer JWT cannot `createBook` → `FORBIDDEN` (shop role required).

## GraphQL — shop

- **API-BOOKS-07** Shop with a store: `createBook` with title, author, priceCents ≥ 1 → listed if stock > 0, `coverUrl` is `/media/covers/...` when MinIO is up, ES document when ELK is up.
- **API-BOOKS-08** `createBook` with stock 0 → status `sold_out`.
- **API-BOOKS-09** `createBook` without a store → error “Open a store first”.
- **API-BOOKS-10** `myBooks` returns only that shop’s books.
- **API-BOOKS-11** `updateBook` by owner can change status/category; another shop’s book → FORBIDDEN.
- **API-BOOKS-12** Invalid category enum is rejected by GraphQL validation.

## GraphQL — admin

- **API-BOOKS-13** Marketing or superadmin JWT: `adminBooks` lists across stores; sales JWT → FORBIDDEN.
- **API-BOOKS-14** `adminUpdateBook` can change status, category, price, stock; ES document refreshes when ES is up.

## GraphQL — partner API key

Keys are issued by `store-service`. Catalog validates them via `POST store-service /internal/validate`.

- **API-BOOKS-15** `X-Api-Key: <seed key>` + `searchBooks` → 200, results.
- **API-BOOKS-16** `Authorization: Bearer rwa_live_...` treated as API key (same as header).
- **API-BOOKS-17** Invalid or revoked key → GraphQL `UNAUTHENTICATED` (or Kong 401 if gateway on).
- **API-BOOKS-18** Valid key + `frontpage` / `book` / `createBook` → `FORBIDDEN` (“API keys can only search books”).

## Admin REST

- **API-BOOKS-25** `GET /admin/stats` as roles that have `stats` (superadmin, sales) → `{ books }`; marketing → 403.

## Internal (not on Kong)

- **API-BOOKS-27** `POST /internal/reindex` with secret → `{ ok, indexed }` when ES reachable; without secret → 401.

## Search flag

- **API-BOOKS-28** Flag/env off → search still works (Postgres). Flag on and ES up → full-text/fuzzy behavior differs from `contains` (use a typo query).
- **API-BOOKS-29** Flag on and ES down → fallback to Postgres, not 500.
