# Test scenarios

These files describe **what** to test against this app. They are not runnable tests.

Implement them in a **separate repo** with whatever stack you want (Playwright, k6, REST-assured, Newman, ZAP, Pact, axe, Percy, Lighthouse, …). Unit and integration tests for this codebase may land later on another branch; do not treat this folder as that suite.

Each scenario is a numbered item with actors, preconditions, and expected results. Adapt IDs (`API-AUTH-01`) as test names in your project.

## How to run the app under test

See the repo-root [README](../README.md). Typical local stack:

| Piece | URL | Start |
| --- | --- | --- |
| Public site | https://localhost:3000 (nginx) or http://localhost:3000 (Vite) | `make up` / `pnpm dev:frontend` |
| Admin console | https://localhost:3004 (nginx) or http://localhost:3004 (Vite) | `make up` / `pnpm dev:frontend` |
| GraphQL | http://localhost:3006/graphql | `make up` |
| Auth | http://localhost:3003 | `make up` |
| Kong (optional) | http://localhost:8080 | `make up services=gateway` + `API_GATEWAY_URL` |
| Unleash | http://localhost:4242 | `make up` (`admin` / `unleash4all`) |
| Mailpit | http://localhost:8025 | `make up` |

When Kong is on, prefer the gateway as the public API entry. Service-to-service `/internal/*` is **not** on Kong.

## Demo actors (after `pnpm db:setup`)

Password for every seeded account: **Passw0rd!**

| Actor | Role | Where |
| --- | --- | --- |
| anonymous | — | Public browse/search |
| `buyer` | user | Public site |
| shop owner (printed at seed) | shop | Public site sell tools |
| partner | api_key | `X-Api-Key` + `searchBooks` only |
| `superadmin` | superadmin | Admin: all sections |
| `sales` | sales | Admin: users, stores, orders (not books) |
| `marketing` | marketing | Admin: books (not users/stores/orders) |

Admin accounts cannot use public JWT login. Shop usernames and the demo partner key are printed when seed finishes.

## Layout

| Folder | Intent |
| --- | --- |
| [api/](api/) | HTTP/GraphQL against services or Kong |
| [e2e/](e2e/) | Browser flows on public + admin UIs |
| [load/](load/) | Throughput, latency, saturation |
| [security/](security/) | Authn/z, injection, secrets, webhooks |
| [contract/](contract/) | Schema and consumer/provider shape |
| [chaos/](chaos/) | Dependency down, flag/env, data lag |
| [accessibility/](accessibility/) | WCAG-oriented UI checks |
| [visual/](visual/) | Screenshot baselines for public, shop, and admin UIs |
| [seo/](seo/) | Crawl/index the public catalog; purchase and OpenPanel funnels |

Files inside each folder are split by **domain / service**.

| File | Coverage |
| --- | --- |
| [api/auth.md](api/auth.md) | Login, refresh, session, OAuth, Altcha, password reset |
| [api/users.md](api/users.md) | `/me`, admin users, roles, audit log |
| [api/catalog.md](api/catalog.md) | GraphQL catalog, search, shop/admin mutations |
| [api/sales.md](api/sales.md) | Checkout saga, buyer/seller orders, internal fulfill |
| [api/cart.md](api/cart.md) | Guest cart cookie, login merge, TTL, pay |
| [api/inventory.md](api/inventory.md) | Stock peek, reserve, release |
| [api/payment.md](api/payment.md) | Stripe session, webhook, Connect |
| [api/stores.md](api/stores.md) | Store, Stripe Connect, partner API keys |
| [api/gateway.md](api/gateway.md) | Kong JWT, API key, rate limits |
| [api/minio.md](api/minio.md) | S3 bucket, HTTPS `/media/` |
| [e2e/public-site.md](e2e/public-site.md) | Browse, search, cart, buyer checkout |
| [e2e/shop.md](e2e/shop.md) | Store, inventory, sales, keys |
| [e2e/admin-console.md](e2e/admin-console.md) | Admin roles and sections |
| [load/catalog.md](load/catalog.md) | Frontpage, search, ES on/off |
| [load/auth-checkout-gateway.md](load/auth-checkout-gateway.md) | Auth, checkout, Kong, OTel |
| [security/auth-authz-payments.md](security/auth-authz-payments.md) | Authn/z, IDOR, injection, secrets |
| [contract/schemas.md](contract/schemas.md) | GraphQL, REST, internal, flags |
| [chaos/services-data-flags.md](chaos/services-data-flags.md) | Service/data/flag failure |
| [accessibility/public-site.md](accessibility/public-site.md) | Public WCAG-oriented checks |
| [accessibility/admin-shop.md](accessibility/admin-shop.md) | Admin + seller tools a11y |
| [visual/public-site.md](visual/public-site.md) | Public screenshots, viewports, auth chrome |
| [visual/shop.md](visual/shop.md) | Seller store, inventory, sales, keys |
| [visual/admin-console.md](visual/admin-console.md) | Admin sign-in, role chrome, tables |
| [seo/public-site.md](seo/public-site.md) | SPA crawlability, titles, catalog links, noindex surfaces |
| [seo/funnels.md](seo/funnels.md) | Home → search → book → checkout; OpenPanel events |
