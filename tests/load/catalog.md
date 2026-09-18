# Load — Catalog and search

Drive HTTP at Kong `:8080` when enabled, else `:3006`. Watch Grafana p95, Jaeger, and Postgres/ES.

- **LOAD-CAT-01** Sustained `frontpage` GraphQL, N VUs, 5–10 min: error rate ~0%, p95 budget you set (e.g. < 500 ms local).
- **LOAD-CAT-02** Mix `searchBooks` queries (popular terms, typos, category+offset).
- **LOAD-CAT-03** Repeat LOAD-CAT-02 with `search.elasticsearch` on vs off; compare p95 and error rate.
- **LOAD-CAT-04** Partner `searchBooks` with `X-Api-Key` at the same RPS as anonymous.
- **LOAD-CAT-05** Spike 3× RPS for 30s; recover without 5xx storm.
- **LOAD-CAT-06** Soak 30+ min for memory/FD leak on books-service and ES.
