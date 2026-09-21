# API — Auth (`auth-service`, port 3003, Kong `/auth`)

Public JWT login/signup and admin session login use Altcha when `auth.altcha` is on (default). CORS allows `http://localhost:3000` and `http://localhost:3004` with credentials.

## Login and tokens

- **API-AUTH-01** JWT login as `buyer` with valid password and captcha → 200, `accessToken`, `refreshToken`, `tokenType: Bearer`, `user.role` is `user`.
- **API-AUTH-02** JWT login as `superadmin` → 403 (admin must use the admin console).
- **API-AUTH-03** JWT login unknown user or wrong password → 401, body may include `captcha` and `failedAttempts`.
- **API-AUTH-04** JWT login missing username or password → 400.
- **API-AUTH-05** Access token authorizes `GET /me` on the same auth-service; `Authorization: Bearer <refreshToken>` does not (`typ` must be `access`).
- **API-AUTH-06** After 15 minutes (or a token minted with short TTL in a test env), `GET /me` → 401 `code: token_expired`.
- **API-AUTH-07** `POST /auth/jwt/refresh` with a valid unused refresh token → new access + refresh pair; old refresh cannot be reused.
- **API-AUTH-08** Reuse a rotated refresh token → 401 `refresh_token_reused` (or family revoked).
- **API-AUTH-09** `POST /auth/jwt/logout` with refresh token → subsequent refresh fails; access token may still work until expiry (document actual behavior).
- **API-AUTH-10** `GET /auth/oauth/providers` → `{ google: true|false, altcha: true|false }` matching Google env and whether Altcha is on.
- **API-AUTH-10a** `GET /auth/captcha/status` → `{ enabled }` matching Unleash `auth.altcha` and `ALTCHA_ENABLED`.

## Signup

- **API-AUTH-11** JWT signup with first/last/username/password + captcha → 201, tokens, `role: user`.
- **API-AUTH-12** Signup duplicate username → 409.
- **API-AUTH-13** Signup missing fields → 400.
- **API-AUTH-14** Signup without a valid Altcha payload → captcha failure (not a created user) when Altcha is on.
- **API-AUTH-14a** `ALTCHA_ENABLED=false` (or Unleash `auth.altcha` off): JWT login, session login, and signup succeed without `altcha`; `GET /auth/captcha/challenge` → 404; the sign-in widgets are not rendered.

## Captcha / throttle

- **API-AUTH-15** `GET /auth/captcha/challenge?mode=frictionless` returns a solvable challenge.
- **API-AUTH-16** Three failed JWT or session logins for the same username+IP within 15 minutes → that 401 (and the next attempt) uses interactive captcha mode when Altcha is on.
- **API-AUTH-17** After a successful login, failed-password counter for that username+IP is cleared.

## Admin session

- **API-AUTH-18** `POST /auth/session/login` as `superadmin` with captcha → 200 + `Set-Cookie: rwa.admin.sid`.
- **API-AUTH-18a** Session login without a valid Altcha payload → captcha failure when Altcha is on (same as JWT).
- **API-AUTH-19** Session login as `buyer` (valid password + captcha) → 403.
- **API-AUTH-20** `GET /auth/session/me` with cookie → admin user; without cookie → 401.
- **API-AUTH-21** `POST /auth/jwt/from-session` with cookie → access/refresh pair for the admin.
- **API-AUTH-22** `POST /auth/session/logout` clears cookie; `session/me` then 401.

## OAuth

- **API-AUTH-23** `GET /auth/oauth/google` with Google configured → redirect to Google; unset → 501 (or documented error).
- **API-AUTH-24** Callback with a valid code (mocked IdP) lands a public-role user and tokens via the web hash callback route (see e2e).

## Health

- **API-AUTH-25** `GET /health` → `{ ok: true, service: "auth" }` without auth.

## Password reset

- **API-AUTH-26** `POST /auth/jwt/forgot-password` `{ email }` missing → 400.
- **API-AUTH-27** Known or unknown email → 200 `{ ok: true }` (no account enumeration). Known buyer/shop email appears in Mailpit (`:8025`) with a `/reset?token=` link.
- **API-AUTH-28** Admin email does not get a reset mail.
- **API-AUTH-29** `POST /auth/jwt/reset-password` valid token + password ≥ 8 → 200; old password fails login; new password works; refresh tokens are revoked.
- **API-AUTH-30** Reuse of the same token or an expired token → 400.
