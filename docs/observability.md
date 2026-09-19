# OpenTelemetry (Jaeger + Prometheus + Grafana)

Traces, RED-style metrics from spans, and dashboards. Logs stay in Kibana (`make up services=elasticsearch`). OpenPanel stays product analytics.

| | |
| --- | --- |
| Grafana | http://localhost:3001 (anonymous admin) |
| Prometheus | http://localhost:9090 |
| Jaeger | http://localhost:16686 |
| OTLP (collector) | http://localhost:4318 |
| Unleash flag | `observability.opentelemetry` |
| Env override | `OTEL_ENABLED` |

This stack is Compose profile `observability`. `make up` does not start it. Export is **off** until the flag or env allows it. Restart backends after you change the flag (the SDK starts at process boot so HTTP can be patched).

## Start

```bash
make up services=observability
```

Then turn export on.

**Unleash:** http://localhost:4242 (`admin` / `unleash4all`) → toggle named `observability.opentelemetry` → enable in **development** → `make restart`.

**Env** (same feature, no Unleash required):

| `OTEL_ENABLED` | Result |
| --- | --- |
| `true` / `1` / `yes` / `on` | Export even if the Unleash flag is off |
| `false` / `0` / `no` / `off` | No export even if the Unleash flag is on |
| unset | Unleash flag only |

Compose sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4318` inside backend containers.

## What to open

| UI | Use |
| --- | --- |
| Grafana → **RWA OpenTelemetry** | Call rate and p95 from span metrics |
| Grafana → Explore → Jaeger | One request across services |
| Jaeger | Search traces by service (`auth-service`, `catalog-service`, …) |
| Prometheus | Raw `calls_total` / `duration_milliseconds_*` |

`/health` is not traced.

## Code

| Piece | Path |
| --- | --- |
| Preload (before Express) | `packages/service-kit/src/register.ts` |
| Flag + SDK | `packages/service-kit/src/telemetry.ts` |
| Collector | `docker/observability/otel-collector.yml` |
| Prometheus scrape | `docker/observability/prometheus.yml` |
