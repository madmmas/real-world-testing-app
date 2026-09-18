# Backup and restore (local)

This stack is Postgres + MinIO. Unleash, Elasticsearch, and OpenPanel have their own volumes; dump those only if a scenario needs them.

## Postgres

Host port is **5433**. Inside Compose the database is `rwa` / user `rwa`.

Dump:

```bash
docker compose exec db pg_dump -U rwa -d rwa --clean --if-exists > backup.sql
```

Restore (overwrites the current database):

```bash
cat backup.sql | docker compose exec -T db psql -U rwa -d rwa
```

Then restart backends if they cached connections: `make restart`.

`pnpm db:setup` is the full reset path (migrate + Faker seed). Use dump/restore when you need a known catalog, orders, or audit rows for a test run.

## MinIO (covers)

Console http://localhost:9001 (`rwa` / `rwaminio1`). Bucket `rwa`.

```bash
docker run --rm --network host -v "$PWD/backup-minio:/data" quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z \
  sh -c 'mc alias set local http://localhost:9000 rwa rwaminio1 && mc mirror local/rwa /data'
```

Restore:

```bash
docker run --rm --network host -v "$PWD/backup-minio:/data" quay.io/minio/mc:RELEASE.2025-08-13T08-35-41Z \
  sh -c 'mc alias set local http://localhost:9000 rwa rwaminio1 && mc mirror --overwrite /data local/rwa'
```

Book `coverUrl` values under `/media/` only resolve if the object is in the bucket.

## What this does not cover

Kafka-style outbox, point-in-time WAL shipping, and encrypted offsite copies. For this repo, dump + MinIO mirror is enough to reset a tester's environment.
