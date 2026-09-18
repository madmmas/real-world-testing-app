# Elasticsearch

Local book search and Docker log analysis. Postgres stays the catalog source of truth.

| | |
| --- | --- |
| Elasticsearch | http://localhost:9200 |
| Kibana | http://localhost:5601 |
| Book index | `rwa-books` (copied from Postgres when Elasticsearch is up; also on create/update) |
| Docker logs | `rwa-logs-*` (Filebeat, while this stack is up) |
| Search flag | `search.elasticsearch` |
| Env override | `ELASTICSEARCH_SEARCH_ENABLED` |

This stack is Compose profile `elasticsearch`. `make up` does not start it.

## Start

```bash
make up services=elasticsearch
```

That starts Elasticsearch, Kibana, and Filebeat. Filebeat tails **Docker json-file logs** and ships them to Elasticsearch. Stop the profile (`make down services=elasticsearch`) and collection stops.

Compose sets `ELASTICSEARCH_URL=http://elasticsearch:9200` inside backend containers. On the host use `http://localhost:9200` from `.env`.

## Book index

When Elasticsearch is reachable, books-service copies every row in Postgres into `rwa-books` (on boot, every 15s if the index is behind, and on the first flagged search). GraphQL `createBook` / updates still write one document. Seed calls `POST /internal/reindex` if books-service is already up.

You do not need to restart books-service after `make up services=elasticsearch`; the next poll fills the index from Postgres.

## Book search (feature-flagged)

`searchBooks` uses Elasticsearch only when the flag is allowed. Otherwise it uses Prisma `contains`.

**Unleash:** http://localhost:4242 → toggle named `search.elasticsearch` → enable in **development**.

**Env** (same feature, no Unleash required):

| `ELASTICSEARCH_SEARCH_ENABLED` | Result |
| --- | --- |
| `true` / `1` / `yes` / `on` | ES search even if the Unleash flag is off |
| `false` / `0` / `no` / `off` | Postgres search even if the Unleash flag is on |
| unset | Unleash flag only |

If Elasticsearch is down, search falls back to Postgres even when the flag is on.

```bash
curl -s http://localhost:3006/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ searchBooks(q: \"ocean\", limit: 5) { title author } }"}'
```

## Log analysis

Filebeat bind-mounts `/var/lib/docker/containers`. That path is reliable on Linux Docker. On Docker Desktop for Mac/Windows it is inside the Linux VM; if Discover stays empty, check `make logs services=elasticsearch` for Filebeat and that backends are running in Compose.

In Kibana: **Discover → Create data view**.

| Data view | Time field |
| --- | --- |
| `rwa-logs*` | `@timestamp` |
| `filebeat-*` | `@timestamp` (if Filebeat used its default index) |

Filter by `service`, `status`, `path`, or Docker `container.name`.

## Code

| Piece | Path |
| --- | --- |
| ES client | `packages/service-kit/src/elasticsearch.ts` |
| JSON stdout | `createService` in `packages/service-kit` |
| Filebeat | `docker/filebeat/filebeat.yml` |
| Flag | `backend/books-service/src/flags.ts` (`search.elasticsearch`) |
| Index + search | `backend/books-service/src/search.ts` |
