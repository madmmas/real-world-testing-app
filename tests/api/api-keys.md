# API — API keys (`api-key-service`, port 3009)

Keys are `rwa_live_` + hex. Only hashed values are stored. Validate is internal.

- **API-KEYS-01** Shop owner `GET /me/keys` → list with prefix, no plaintext except on create.
- **API-KEYS-02** Buyer `GET /me/keys` → 403.
- **API-KEYS-03** Shop `POST /me/keys` `{ name }` → 201 with one-time `plaintext` starting `rwa_live_`.
- **API-KEYS-04** Non-owner store member (if any) cannot create/revoke.
- **API-KEYS-05** `DELETE /me/keys/:id` revokes; validate then 401; GraphQL search with that key fails.
- **API-KEYS-06** Delete another store’s id → no-op or 403; their key still works.
- **API-KEYS-07** `POST /internal/validate` `{ key }` with secret → `{ storeId }`; wrong secret → 401.
- **API-KEYS-08** Validate revoked or unknown key → 401.
