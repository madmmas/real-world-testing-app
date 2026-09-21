# Admin session authentication

The **public site does not use sessions**. Buyers and shops use JWTs ([jwt.md](jwt.md)). The **admin console** uses an HttpOnly cookie session on auth-service, then mints a JWT from that session for every other API.

Session middleware lives in `backend/auth-service/src/index.ts`. Routes live in `backend/auth-service/src/routes.ts` under `/auth/session/*` and `POST /auth/jwt/from-session`. The admin UI is `frontend/admin/src/auth.tsx` (`credentials: "include"`).

| | Session | Access JWT (after mint) |
| --- | --- | --- |
| Who | Admin console only (`superadmin`, `sales`, `marketing`) | All APIs except `/auth`, `/config`, Stripe webhooks |
| Credential | Cookie `rwa.admin.sid` | `Authorization: Bearer …` |
| Store | Postgres `session` table (`connect-pg-simple`) | Nowhere until `exp` |
| Lifetime | 7 days (`cookie.maxAge`) | 15 minutes (then refresh or remint from cookie) |
| Revoked | `session.destroy` + `clearCookie` | Access JWT still valid until `exp`; refresh family is revoked on logout / remint |

Cookie flags:

| Flag | Value |
| --- | --- |
| Name | `rwa.admin.sid` |
| HttpOnly | yes |
| SameSite | `Lax` |
| Secure | `auto` — only when the request is HTTPS (`trust proxy` + `X-Forwarded-Proto`) |
| Max-Age | 7 days |
| Signed with | `SESSION_SECRET` (express-session) |
| `saveUninitialized` | false (no empty cookie on anonymous hits) |
| `resave` | false |

Session payload in Postgres:

| Field | Set when |
| --- | --- |
| `userId` | `POST /auth/session/login` |
| `refreshFamilyId` | `POST /auth/jwt/from-session` (so logout can revoke that JWT family) |

`GET /admin/*` and GraphQL still require the access JWT. The cookie is **not** accepted as `requireJwt`. Kong skips `/auth` (login, session, captcha) and still requires a JWT on `/admin`, `/me`, `/graphql` mutations, and so on.

Guest cart cookie `rwa.cart` is unrelated (order-service, public site).

---

## 1. Session login (admin)

Same password + Altcha path as public JWT login, then a role gate: only admin roles get a cookie.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: POST /auth/session/login (username, password, altcha)
  Note over AdminUI,Auth: credentials include so Set-Cookie is stored
  Auth->>Auth: verify Altcha if enabled
  Auth->>DB: find user by username
  Auth->>Auth: bcrypt compare
  alt admin role
    Auth->>Auth: session.userId = user.id
    Auth->>DB: upsert connect-pg-simple session row
    Auth-->>AdminUI: 200 user + Set-Cookie rwa.admin.sid
  else public role
    Auth-->>AdminUI: 403 This account is not a platform admin
  else bad password
    Auth-->>AdminUI: 401 Username or password is invalid
  end
```

The login response does **not** include JWTs. The UI calls `from-session` next (flow 5).

## 2. Public role cannot open an admin session

Buyers and shops must use `POST /auth/jwt/login`. A valid password on the session endpoint is still 403.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: POST /auth/session/login as buyer or shop
  Auth->>DB: user found, password ok
  Auth->>Auth: isAdminRole is false
  Auth-->>AdminUI: 403
  Note over Auth: no Set-Cookie, session not saved
```

The inverse is also true: admins on `POST /auth/jwt/login` get 403 (`Use the admin console to sign in`).

## 3. Failed password and captcha throttle

Shared with public JWT login: username+IP, 15 minute window, 3 failures → interactive Altcha when the flag is on.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service

  AdminUI->>Auth: POST /auth/session/login wrong password
  Auth->>Auth: recordFailedPassword(ip, username)
  Auth-->>AdminUI: 401 + failedAttempts (+ captcha mode if Altcha on)

  loop until 3 failures in 15 minutes
    AdminUI->>Auth: another wrong password
  end
  Auth-->>AdminUI: 401 captcha interactive

  AdminUI->>Auth: successful session login
  Auth->>Auth: clearFailedPasswords
  Auth-->>AdminUI: 200 + cookie
```

## 4. Who am I (`GET /auth/session/me`)

Used on admin bootstrap. Does not mint JWTs. User must still be an admin in Postgres.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: GET /auth/session/me Cookie rwa.admin.sid
  Auth->>Auth: lookup session store by sid
  alt no cookie or empty session.userId
    Auth-->>AdminUI: 401 Unauthorized
  else user missing or not admin
    Auth->>DB: find user
    Auth-->>AdminUI: 401 Unauthorized
  else ok
    Auth->>DB: find user
    Auth-->>AdminUI: 200 { user }
  end
```

## 5. Mint JWT from session

Admin APIs are JWT-gated. After login (or on every page load), the UI posts the cookie and receives an access/refresh pair. A previous family on this session is revoked first so reminting does not leave two live refresh families.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: POST /auth/jwt/from-session Cookie rwa.admin.sid
  Auth->>Auth: session.userId required
  Auth->>DB: load user, must be admin
  opt session.refreshFamilyId already set
    Auth->>DB: revokeFamily(that id)
  end
  Auth->>Auth: issueTokenPair (access JWT + refresh)
  Auth->>DB: insert RefreshToken
  Auth->>Auth: session.refreshFamilyId = familyId
  Auth-->>AdminUI: 200 tokens (no user body)
```

Refresh tokens stay in **memory** in the admin app (not `sessionStorage`). The cookie is what survives a reload.

## 6. Admin UI bootstrap

Reload keeps the cookie. The UI rehydrates the user from `session/me`, then remints JWTs.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service

  AdminUI->>Auth: GET /auth/session/me credentials include
  alt 401
    AdminUI->>AdminUI: user = null, clear in-memory JWTs
  else 200
    AdminUI->>AdminUI: setUser
    AdminUI->>Auth: POST /auth/jwt/from-session
    Auth-->>AdminUI: access + refresh
    AdminUI->>AdminUI: keep tokens in memory
  end
```

## 7. Admin API call (cookie is not enough)

`/admin/users`, GraphQL admin mutations, `/admin/orders`, and so on use `requireJwt`. Kong (when on) also requires a Bearer access JWT. Sending only `rwa.admin.sid` to those paths fails.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Kong as Kong access.lua
  participant API as catalog / order / store / auth

  AdminUI->>Kong: GET /admin/orders Cookie only, no Bearer
  Note over Kong: path is not /auth — JWT required
  Kong-->>AdminUI: 401 Missing bearer token

  AdminUI->>Kong: GET /admin/orders Authorization Bearer accessJWT
  Kong->>Kong: verify typ=access
  Kong->>API: proxy
  API->>API: requireJwt then requireAdmin / requireSection
  API-->>AdminUI: 200 or 403 for this admin role
```

`/auth/session/*` and `/auth/jwt/from-session` skip Kong JWT checks because they are under `/auth`.

## 8. Access JWT expired: refresh, then remint from cookie

Admin refresh tries the in-memory refresh token first. If that fails (logout elsewhere, reuse, expiry), it posts `from-session` again while the cookie is still valid.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant API as backend

  AdminUI->>API: Bearer access JWT near expiry
  AdminUI->>Auth: POST /auth/jwt/refresh { refreshToken }
  alt refresh ok
    Auth-->>AdminUI: new pair
    AdminUI->>API: retry with new access JWT
  else refresh 401
    AdminUI->>Auth: POST /auth/jwt/from-session Cookie
    alt cookie still valid
      Auth-->>AdminUI: new pair (old family revoked)
      AdminUI->>API: retry
    else cookie gone
      Auth-->>AdminUI: 401
      AdminUI->>AdminUI: user = null, send to /signin
    end
  end
```

## 9. Logout

The UI revokes the refresh family, then destroys the session cookie. Outstanding access JWTs still work until `exp`.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Auth as auth-service
  participant DB as Postgres

  AdminUI->>Auth: POST /auth/jwt/logout { refreshToken }
  Auth->>DB: revokeFamily for that token
  Auth-->>AdminUI: 204

  AdminUI->>Auth: POST /auth/session/logout Cookie
  Auth->>DB: revokeFamily(session.refreshFamilyId) if set
  Auth->>Auth: session.destroy
  Auth-->>AdminUI: 204 + clearCookie rwa.admin.sid

  AdminUI->>Auth: GET /auth/session/me
  Auth-->>AdminUI: 401
```

## 10. CORS and CSRF

Session login is credentialed. CORS allowlist is `WEB_ORIGIN` and `ADMIN_ORIGIN` plus their http/https twins. `SameSite=Lax` blocks cross-site POSTs from another origin.

```mermaid
sequenceDiagram
  actor Evil as evil.example
  participant Auth as auth-service

  Evil->>Auth: POST /auth/session/login Origin http://evil.example credentials
  Auth-->>Evil: CORS reject (no Access-Control-Allow-Origin)

  Note over Auth: SameSite=Lax also omits the cookie on cross-site POST
```

## 11. HTTP vs HTTPS cookie Secure flag

`app.set("trust proxy", 1)` and `cookie.secure: "auto"`: Vite HTTP on :3004 gets a non-Secure cookie; nginx HTTPS on :3004 gets `Secure`.

```mermaid
sequenceDiagram
  actor AdminUI
  participant Nginx as nginx TLS
  participant Auth as auth-service

  AdminUI->>Nginx: https://localhost:3004 POST /auth/session/login
  Nginx->>Auth: X-Forwarded-Proto https
  Auth-->>AdminUI: Set-Cookie rwa.admin.sid; Secure; HttpOnly; SameSite=Lax

  Note over AdminUI,Auth: Vite http://localhost:3004 — cookie without Secure
```
