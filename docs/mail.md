# Mailpit (password reset)

Local SMTP catcher. Auth sends reset mail here; nothing goes to the public internet.

| | |
| --- | --- |
| UI | http://localhost:8025 |
| SMTP | localhost:1025 (in Compose: `mailpit:1025`) |
| Enable | `make up` (default) |

Forgot password: https://localhost:3000/forgot (`POST /auth/jwt/forgot-password`). The message always returns `{ ok: true }`. If the email matches a buyer or shop user, Mailpit shows a one-hour link to `/reset?token=`.

Reset: `POST /auth/jwt/reset-password` with `{ token, password }` (min 8 chars). Refresh tokens for that user are revoked.
