# API — MinIO (S3 via nginx HTTPS)

MinIO API is HTTP on `:9000`. Browser reads go through nginx TLS.

- **API-S3-01** `GET https://localhost:3000/media/health.txt` (`-k` for the demo cert) → `ok`.
- **API-S3-02** `GET http://localhost:9000/rwa/health.txt` → same object (path-style).
- **API-S3-03** PUT a file with `S3_ACCESS_KEY` / `S3_SECRET_KEY` to bucket `rwa`; GET it from `/media/<key>` over HTTPS.
- **API-S3-04** PUT/POST `/media/anything` through nginx → 403 (writes are not proxied).
- **API-S3-05** Invalid credentials on `:9000` → 403 from MinIO, not from nginx.
- **API-S3-06** Console http://localhost:9001 accepts `rwa` / `rwaminio1`.
