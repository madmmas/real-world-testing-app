# MinIO (S3-compatible)

Object storage for local tests. The API and console stay **HTTP**. Browsers fetch objects over **nginx HTTPS**.

| | |
| --- | --- |
| API (path-style) | http://localhost:9000 |
| Console | http://localhost:9001 (`rwa` / `rwaminio1`) |
| HTTPS GET | https://localhost:3000/media/health.txt |
| Bucket | `rwa` (anonymous download) |
| Enable | `make up` (default) |

Backends see `S3_ENDPOINT=http://minio:9000` inside Compose. On the host, use `http://localhost:9000` from `.env`.

## Start

```bash
make up
```

`minio-init` creates bucket `rwa`, sets anonymous download, and writes `health.txt`.

```bash
curl -fk https://localhost:3000/media/health.txt
# ok
```

The first visit to https://localhost:3000 uses a self-signed cert — accept it in the browser (or `curl -k`).

## Credentials

| | |
| --- | --- |
| Access key | `MINIO_ROOT_USER` (`rwa`) |
| Secret | `MINIO_ROOT_PASSWORD` (`rwaminio1`) |
| Region | `us-east-1` |
| Path style | `S3_FORCE_PATH_STYLE=true` |

Writes (PUT/POST) go to `:9000` with those keys. nginx `/media/` allows GET/HEAD only.

## Stop

```bash
make down services=minio
```

Volume `minio-data` keeps objects. `make down` without `services=` also stops MinIO (Postgres stays up).
