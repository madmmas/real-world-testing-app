# JWT and refresh tokens

There are two credentials. The **JWT is only the access token**. The **refresh token is not a JWT**: it is a random opaque string stored as a SHA-256 hash.

Issue and rotate live in `backend/auth-service/src/tokens.ts`. Verify lives in `packages/service-kit` (`requireJwt`, `optionalJwt`, `verifyAccessToken`) and, when Kong is up, in `docker/kong/access.lua`. Role is **not** in the JWT; after a valid access token, services load the user from Postgres.

| | Access JWT | Refresh token |
| --- | --- | --- |
| Format | HS256 JWT | 32-byte random, base64url |
| Stored | Nowhere (stateless until `exp`) | `RefreshToken.tokenHash` (SHA-256) |
| TTL | `JWT_ACCESS_EXPIRES` (default **15m**) | Sliding `JWT_REFRESH_EXPIRES_DAYS` (7) capped by `JWT_REFRESH_ABSOLUTE_DAYS` (30) |
| Sent as | `Authorization: Bearer …` | JSON body (`refreshToken`) on `/auth/jwt/refresh` and logout |
| Revoked | Not until expiry (`jti` is unused) | Family revoke on logout, reuse, or password reset |

Who gets a pair:

| Flow | Roles | Endpoint |
| --- | --- | --- |
| Password login | `user`, `shop` only | `POST /auth/jwt/login` |
| Signup | always `user` | `POST /auth/jwt/signup` |
| Google OAuth | public roles only | `/auth/oauth/google/callback` |
| Admin after session cookie | `superadmin`, `sales`, `marketing` | `POST /auth/jwt/from-session` |

Admins cannot use public JWT login (403). Public roles cannot use session login (403).

## Access JWT claims

Signed with `JWT_SECRET`, `algorithm: HS256`, `iss` = `JWT_ISSUER` (default `rwa-auth`), `aud` = `JWT_AUDIENCE` (default `rwa`).

| Claim | Meaning |
| --- | --- |
| `sub` | user id |
| `username` | username |
| `typ` | always `"access"` |
| `jti` | unique id per token (not denylisted) |
| `iss` / `aud` / `exp` | set by `jsonwebtoken` |

Verify always requires HS256, matching `iss`/`aud`, 5s clock skew, and `typ === "access"`. A refresh string used as Bearer fails (`token_invalid`). Expired access → `token_expired`. Missing Bearer on a required route → `token_invalid`.

## RefreshToken rows

| Field | Role |
| --- | --- |
| `tokenHash` | unique SHA-256 of the raw token |
| `familyId` | rotation family; reuse of a revoked member revokes the whole family |
| `expiresAt` | sliding window |
| `absoluteExpiresAt` | hard cap, copied onto each rotation |
| `revokedAt` | set on rotate, logout, expiry, or family kill |
| `replacedById` | points at the next row after a successful rotate |

Public site keeps the raw refresh token in `sessionStorage` (`rwa.public.refresh`) and refreshes ~30s before access expiry. Admin keeps tokens in memory after `from-session`.

---

## 1. Public JWT login (issue pair)

Password login for `user` / `shop`. Captcha runs first when Altcha is on. Admins get 403.

```mermaid
sequenceDiagram
  actor Browser
  participant Auth as auth-service
  participant DB as Postgres

  Browser->>Auth: POST /auth/jwt/login (username, password, altcha)
  Auth->>Auth: verify Altcha if enabled
  Auth->>DB: find user by username
  Auth->>Auth: bcrypt compare
  alt public role
    Auth->>Auth: sign HS256 access JWT (typ=access, 15m)
    Auth->>Auth: random refresh token
    Auth->>DB: insert RefreshToken (hash, familyId, expiries)
    Auth-->>Browser: 200 user + accessToken + refreshToken
  else admin role
    Auth-->>Browser: 403 Use the admin console to sign in
  else bad password
    Auth-->>Browser: 401 Username or password is invalid
  end
```

## 2. Public JWT signup (issue pair)

Creates a `user` account and the same token pair as login.

```mermaid
sequenceDiagram
  actor Browser
  participant Auth as auth-service
  participant DB as Postgres

  Browser->>Auth: POST /auth/jwt/signup
  Auth->>Auth: verify Altcha (frictionless) if enabled
  Auth->>DB: username unique?
  alt taken
    Auth-->>Browser: 409 Username already taken
  else new
    Auth->>DB: insert User (role=user, hashed password)
    Auth->>Auth: sign access JWT + random refresh
    Auth->>DB: insert RefreshToken
    Auth-->>Browser: 201 user + tokens
  end
```

## 3. Google OAuth (issue pair)

Callback mints the same pair, then redirects the public site with tokens in the URL hash (not a cookie).

```mermaid
sequenceDiagram
  actor Browser
  participant Auth as auth-service
  participant Google
  participant DB as Postgres

  Browser->>Auth: GET /auth/oauth/google
  Auth-->>Browser: redirect to Google
  Browser->>Google: consent
  Google-->>Browser: redirect with code
  Browser->>Auth: GET /auth/oauth/google/callback?code=
  Auth->>Google: exchange code for Google access token
  Auth->>Google: fetch profile
  Auth->>DB: find or create public-role user by email
  alt admin email
    Auth-->>Browser: redirect /signin?error=Use the admin console
  else public role
    Auth->>Auth: sign access JWT + random refresh
    Auth->>DB: insert RefreshToken
    Auth-->>Browser: redirect /signin/callback#access_token&refresh_token
  end
```

## 4. Admin session then JWT

Admin console uses cookie `rwa.admin.sid`. APIs still need an access JWT, minted from that session. Cookie flags, bootstrap, remint-on-refresh-failure, CORS, and logout: [session.md](session.md).

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: POST /auth/session/login (credentials + cookie jar)
  Auth->>DB: find admin user
  Auth->>Auth: set session.userId
  Auth-->>AdminUI: 200 Set-Cookie rwa.admin.sid

  AdminUI->>Auth: POST /auth/jwt/from-session (cookie)
  Auth->>Auth: require session.userId + admin role
  opt previous family on this session
    Auth->>DB: revokeFamily(session.refreshFamilyId)
  end
  Auth->>Auth: issue new access + refresh pair
  Auth->>DB: insert RefreshToken
  Auth->>Auth: session.refreshFamilyId = familyId
  Auth-->>AdminUI: 200 tokens (no user body)
```

## 5. Required access JWT (REST)

Kong (if `make up services=gateway`) checks first. Backends always check again with `requireJwt`, then load role from the database.

```mermaid
sequenceDiagram
  actor Client
  participant Kong as Kong access.lua
  participant API as backend (service-kit)
  participant DB as Postgres

  Client->>Kong: GET /me Authorization Bearer accessJWT
  Kong->>Kong: skip only /auth /config /api/stripe
  Kong->>Kong: HMAC, iss, aud, typ=access, exp (±5s)
  alt missing / bad / wrong typ
    Kong-->>Client: 401 token_invalid
  else expired
    Kong-->>Client: 401 token_expired
  else ok
    Kong->>API: proxy same Authorization
    API->>API: jwt.verify HS256 + iss/aud + typ=access
    API->>DB: load user by sub
    alt buyer / shop / admin gate fails
      API-->>Client: 403
    else allowed
      API-->>Client: 200
    end
  end
```

Without Kong, the client hits the service port and only the `requireJwt` half runs.

## 6. Optional JWT (GraphQL frontpage and guest cart)

Anonymous is allowed. If a Bearer is sent, it must still be a valid **access** JWT.

```mermaid
sequenceDiagram
  actor Client
  participant Kong as Kong
  participant API as catalog or order

  Client->>Kong: POST /graphql or /cart (no Authorization)
  Kong->>Kong: mode optional, no bearer
  Kong->>API: proxy
  API->>API: optionalJwt / verifyAccessToken: no token
  API-->>Client: 200 anonymous (frontpage or guest cart cookie)

  Client->>Kong: same path + Bearer accessJWT
  Kong->>Kong: verify access JWT
  Kong->>API: proxy
  API->>API: attach req.user from JWT
  API-->>Client: 200 as that user
```

Partner `X-Api-Key` (or `Bearer rwa_live_…`) is GraphQL-only. Kong rejects keys on required REST routes (`API keys can only search books`).

## 7. Refresh rotation (success)

Old refresh row is revoked in a transaction; a new raw token is issued in the **same family**. A new access JWT is signed. Sliding `expiresAt` cannot pass the original `absoluteExpiresAt`.

```mermaid
sequenceDiagram
  actor Client
  participant Auth as auth-service
  participant DB as Postgres

  Client->>Auth: POST /auth/jwt/refresh { refreshToken }
  Auth->>Auth: SHA-256 lookup
  Auth->>DB: find RefreshToken + user
  Auth->>Auth: not revoked, not past expiresAt or absoluteExpiresAt
  Auth->>DB: transaction: revoke old, insert next, set replacedById
  Auth->>Auth: sign new access JWT
  Auth-->>Client: 200 new accessToken + refreshToken
```

Public and admin UIs call this ~30s before access `expiresAt`, and again if GraphQL returns `UNAUTHENTICATED`.

## 8. Refresh reuse (stolen or replayed token)

Presenting a token whose row already has `revokedAt` (already rotated) kills the **entire family**.

```mermaid
sequenceDiagram
  actor Attacker
  participant Auth as auth-service
  participant DB as Postgres

  Attacker->>Auth: POST /auth/jwt/refresh { old already-rotated token }
  Auth->>DB: find row by hash
  Auth->>Auth: revokedAt is set
  Auth->>DB: revokeFamily(familyId) all unused members
  Auth-->>Attacker: 401 code refresh_token_reused
```

## 9. Refresh expired or unknown

```mermaid
sequenceDiagram
  actor Client
  participant Auth as auth-service
  participant DB as Postgres

  Client->>Auth: POST /auth/jwt/refresh { refreshToken }

  alt hash not in DB
    Auth-->>Client: 401 refresh_token_invalid
  else expiresAt or absoluteExpiresAt in the past
    Auth->>DB: set revokedAt on this row
    Auth-->>Client: 401 refresh_token_expired
  end
```

## 10. Logout (revoke refresh family)

Access JWTs already issued keep working until `exp`.

```mermaid
sequenceDiagram
  actor Client
  participant Auth as auth-service
  participant DB as Postgres
  participant API as any requireJwt route

  Client->>Auth: POST /auth/jwt/logout { refreshToken }
  Auth->>DB: find family by hash
  Auth->>DB: revokeFamily (all unused rows)
  Auth-->>Client: 204

  Client->>Auth: POST /auth/jwt/refresh { that refresh }
  Auth-->>Client: 401 refresh_token_reused or invalid

  Client->>API: Authorization Bearer still-unexpired access JWT
  API-->>Client: 200 until exp
```

Admin `POST /auth/session/logout` also revokes `session.refreshFamilyId` if present, then destroys the cookie.

## 11. Password reset (revoke all of the user’s refresh rows)

Does not wait for family reuse: every unused refresh for that user is revoked. Access JWTs still live until expiry.

```mermaid
sequenceDiagram
  actor Browser
  participant Auth as auth-service
  participant DB as Postgres

  Browser->>Auth: POST /auth/jwt/reset-password { token, password }
  Auth->>DB: find unused unexpired PasswordResetToken
  Auth->>DB: update password hash, mark reset used
  Auth->>DB: revokeUserRefreshTokens(userId)
  Auth-->>Browser: 200 { ok: true }
```

## 12. Refresh used as a Bearer JWT

`typ` must be `access`. The opaque refresh string is not a signed JWT.

```mermaid
sequenceDiagram
  actor Client
  participant API as service-kit requireJwt

  Client->>API: GET /me Authorization Bearer refreshToken
  API->>API: jwt.verify fails or typ is not access
  API-->>Client: 401 token_invalid
```

Kong does the same check when the gateway is on (`claims.typ ~= "access"`).
