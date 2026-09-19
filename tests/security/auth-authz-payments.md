# Security — Authentication and session

- **SEC-AUTH-01** Password not returned on any user JSON.
- **SEC-AUTH-02** Refresh tokens stored hashed (DB has hashes, not raw tokens).
- **SEC-AUTH-03** Access JWT `alg: none` / wrong `iss`/`aud`/`typ` rejected at service and at Kong.
- **SEC-AUTH-04** Cookie `rwa.admin.sid` is HttpOnly; not readable from `document.cookie`.
- **SEC-AUTH-05** CORS: origin `http://evil.example` cannot call credentialed `/auth/session/login`.
- **SEC-AUTH-06** CSRF: cross-site POST to session login from another origin is blocked (SameSite=Lax).
- **SEC-AUTH-07** Admin session cannot be used as public JWT login.
- **SEC-AUTH-08** Rate limit login brute force (API throttle + Kong).
- **SEC-AUTH-09** Altcha cannot be skipped on public JWT login, public signup, or admin session login by omitting the payload.
- **SEC-AUTH-09a** Three consecutive wrong passwords (username+IP, 15 minutes) require the interactive bot check on both public and admin login.
- **SEC-AUTH-10** Forgot-password always `{ ok: true }`; reset tokens stored hashed; reuse after success fails.

## Authorization / IDOR

- **SEC-AZ-01** Shop A cannot `updateBook` / see `myBooks` for shop B.
- **SEC-AZ-02** Buyer cannot `GET /me/sales` or mutate another user’s `/me`.
- **SEC-AZ-03** Marketing JWT cannot `/admin/users` or `/admin/orders`.
- **SEC-AZ-04** Sales cannot grant `superadmin`.
- **SEC-AZ-05** Partner key cannot call `/checkout`, `/me`, or GraphQL mutations.
- **SEC-AZ-06** Direct host ports while Kong is on: `/internal/*` still requires `x-internal-secret` (ports may still be published).
- **SEC-AZ-07** Guessable order ids: buyer A cannot read buyer B’s order if such a GET exists; if only list-by-token, confirm no id oracle.

## Injection and headers

- **SEC-INJ-01** GraphQL and REST: quotes/operators in search `q` do not error 500 or leak SQL.
- **SEC-INJ-02** Store name / book title XSS: stored string is escaped in public and admin UI.
- **SEC-INJ-03** GraphQL introspection: decide allow/deny for a “production-like” profile and assert.
- **SEC-INJ-04** Batch GraphQL aliases / depth: server stays up (limit or documented lack).

## Secrets and payments

- **SEC-PAY-01** Webhook body with wrong signature never fulfills.
- **SEC-PAY-02** `INTERNAL_SERVICE_SECRET` in a browser bundle or GraphQL error → fail.
- **SEC-PAY-03** Stripe secret / webhook secret never logged in Filebeat/Kibana JSON.
- **SEC-KEY-01** After create key, only hash in DB; plaintext shown once.
