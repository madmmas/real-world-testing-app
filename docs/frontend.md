# Frontends in Docker (nginx + HTTPS)

`make up` starts nginx with the backends. TLS terminates **only** here; app services stay HTTP on the Docker network.

| | |
| --- | --- |
| Public site | https://localhost:3000 |
| Admin console | https://localhost:3004 |
| MinIO objects | https://localhost:3000/media/health.txt |
| Enable | `make up` (default) |
| Image | `nginx:1.27-alpine` after a Node Vite build |

The cert is self-signed (`CN=localhost`). The browser will warn once; `curl` needs `-k`.

Do not run `pnpm dev:frontend` at the same time — both bind 3000 and 3004. For Vite HMR: `make down services=frontend`, set `WEB_ORIGIN`/`ADMIN_ORIGIN` back to `http://localhost:3000` and `:3004`, then `pnpm dev:frontend`.

## Start

```bash
make up
```

That builds `frontend/web` and `frontend/admin` and serves `dist/` from one nginx container. API paths match the Vite proxy (`/auth`, `/graphql`, `/me`, `/checkout`, `/config`, `/api/admin/...` rewritten to `/admin/...`).

`VITE_*` values are baked in at **image build**. Change Unleash or OpenPanel client settings, then `make build services=frontend` (or `make up`, which rebuilds).

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
