# Frontends

TLS is **only** on the nginx container. Vite on the host is always HTTP.

| Mode | Public | Admin | How |
| --- | --- | --- | --- |
| nginx (`make up`) | https://localhost:3000 | https://localhost:3004 | Self-signed `CN=localhost` |
| Vite (`pnpm dev:frontend`) | http://localhost:3000 | http://localhost:3004 | HMR; stop nginx first |

Do not run both at once — they share ports 3000 and 3004.

`.env` `WEB_ORIGIN` / `ADMIN_ORIGIN` stay `http://localhost:3000` and `http://localhost:3004` (Vite). Backends also accept the https origins so nginx TLS works without flipping env. Session cookies use `Secure` only when the request is HTTPS (`X-Forwarded-Proto`).

## nginx

```bash
make up
```

The cert is self-signed. The browser will warn once; `curl` needs `-k`. MinIO objects: https://localhost:3000/media/health.txt.

That builds `frontend/web` and `frontend/admin` and serves `dist/` from one nginx container. API paths match the Vite proxy (`/auth`, `/graphql`, `/me`, `/checkout`, `/cart`, `/config`, `/api/admin/...` rewritten to `/admin/...`).

`VITE_*` values are baked in at **image build**. Change Unleash or OpenPanel client settings, then `make build services=frontend` (or `make up`, which rebuilds).

## Vite HMR

```bash
make down services=frontend
pnpm dev:frontend
```

Leave backends in Docker. Open http://localhost:3000 and http://localhost:3004 (no TLS).

## Kong

Nginx talks to the six backends on the Docker network by default. To send UI API calls through Kong:

```bash
make up services=gateway
```

```
NGINX_GATEWAY=http://kong:8000
```

in `.env` (restart the frontend container after). Host `API_GATEWAY_URL` is only for Vite.

## Stop nginx only

```bash
make down services=frontend
```

`make down` stops nginx together with the app backends (Postgres stays up).
