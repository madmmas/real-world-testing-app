# API — Users (`auth-service`, port 3003, Kong `/me` and `/admin/users|me|stats`)

Admin REST from the Vite app is `/api/admin/...` rewritten to `/admin/...`.

## Public profile

- **API-USER-01** `GET /me` with buyer JWT → profile fields (no password hash).
- **API-USER-02** `GET /me` without token → 401.
- **API-USER-03** `PATCH /me` updates first/last/email/phone for the caller only.
- **API-USER-04** Shop JWT can `GET /me`; admin JWT used on public `/me` follows `requireJwt` then role checks (expect 403 if `loadPublicAccount` rejects admins).

## Admin

- **API-USER-05** `GET /admin/me` with superadmin JWT (from session) → actor + role.
- **API-USER-06** `GET /admin/stats` as superadmin or sales → 200; as marketing → 403.
- **API-USER-07** `GET /admin/users` as sales or superadmin → list; as marketing → 403.
- **API-USER-08** Superadmin can patch a `user` to `shop` and `shop` to `user`.
- **API-USER-09** Sales can patch user ↔ shop only; cannot assign `superadmin` / `sales` / `marketing`.
- **API-USER-10** Marketing cannot `PATCH /admin/users/:id`.
- **API-USER-11** Cannot demote the last superadmin if the API forbids it; if allowed, document the hole.
- **API-USER-12** Buyer JWT on `/admin/users` → 403.
- **API-USER-13** `GET /admin/audit` as superadmin → 200 list (after a role change a `user.role.change` row exists). Sales/marketing → 403.
- **API-USER-14** `PATCH /me` with a non-object body or extra invalid types → 400 from Zod.
