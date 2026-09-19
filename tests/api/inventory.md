# API — Inventory (`inventory-service`, port 3010)

Internal only (not on Kong). Checkout and cart call this service with `x-internal-secret`. Peek does not change stock. Reserve decrements listed stock atomically.

- **API-INV-01** `POST /internal/books/:id` with secret → `{ book }` including `stock`, `status`, `storeId`, `ownerId`. Unknown id → 404.
- **API-INV-02** Same without secret → 401.
- **API-INV-03** `POST /internal/books/:id/reserve` `{ quantity }` on listed in-stock book → stock decremented; `stock` 0 becomes `sold_out`.
- **API-INV-04** Reserve quantity greater than stock, unlisted, or unknown → 400/404; stock unchanged.
- **API-INV-05** Concurrent reserves for last copy: only one succeeds; stock never negative.
- **API-INV-06** `POST /internal/release` `{ items: [{ bookId, quantity }] }` restores stock; `sold_out` with stock > 0 becomes `listed`.
- **API-INV-07** Reserve without `quantity` returns the book and does not decrement (same as peek).
