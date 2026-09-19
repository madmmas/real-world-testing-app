# API — Store (`store-service`, port 3009)

Shop owners manage the store, Stripe Connect, and partner API keys for third-party GraphQL search (`searchBooks` only).

## Store / Stripe Connect

- **API-STORE-01** Shop `POST /me/store` with name → store + slug; second create is 409.
- **API-STORE-02** Shop `GET /me/store` → store or null.
- **API-STORE-03** Buyer `POST /me/store` → 403.
- **API-STORE-04** `POST /me/stripe/connect` with Stripe env set → onboarding URL; unset → documented demo/error.
- **API-STORE-05** `POST /me/stripe/sync` updates `stripeOnboarded`.

## Admin REST

- **API-STORE-06** `GET /admin/stores` as sales or superadmin → 200; marketing → 403.
- **API-STORE-07** `GET /admin/stats` as roles that have `stats` (superadmin, sales) → `{ stores }`; marketing → 403.

## Partner API keys

Keys are `rwa_live_` + hex. Only hashed values are stored. Validate is internal.

- **API-KEYS-01** Shop owner `GET /me/keys` → list with prefix, no plaintext except on create.
- **API-KEYS-02** Buyer `GET /me/keys` → 403.
- **API-KEYS-03** Shop `POST /me/keys` `{ name }` → 201 with one-time `plaintext` starting `rwa_live_`.
- **API-KEYS-04** Non-owner store member (if any) cannot create/revoke.
- **API-KEYS-05** `DELETE /me/keys/:id` revokes; validate then 401; GraphQL search with that key fails.
- **API-KEYS-06** Delete another store’s id → no-op or 403; their key still works.
- **API-KEYS-07** `POST /internal/validate` `{ key }` with secret → `{ storeId }`; wrong secret → 401.
- **API-KEYS-08** Validate revoked or unknown key → 401.
