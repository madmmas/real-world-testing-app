# Load — Auth, checkout, gateway

- **LOAD-AUTH-01** JWT login+refresh mix below Kong `/auth` 40/min/IP (use many IPs or raise limits in a test overlay).
- **LOAD-AUTH-02** Hit `/auth` until 429; confirm other routes still work for that IP if quotas are per-route.
- **LOAD-CHK-01** Concurrent checkout on a book with stock S: successes ≤ S; no negative stock.
- **LOAD-CHK-02** Demo checkout RPS for 5 min; order-service, inventory-service, and Postgres CPU/locks in Grafana/Jaeger.
- **LOAD-GW-01** Same script via `:3006` vs `:8080`; extra Kong latency (`X-Kong-Upstream-Latency` vs total).
- **LOAD-GW-02** OpenTelemetry on: trace export does not collapse RPS vs flag off (overhead budget).
- **LOAD-PAY-01** Stripe webhook flood under 300/min; above that, 429 from Kong without dropping signature verification on allowed traffic.
