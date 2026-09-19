# Funnels — discovery, conversion, analytics

Public site only (`:3000`). Pair with [e2e/public-site.md](../e2e/public-site.md) and [docs/openpanel.md](../../docs/openpanel.md). Seed with `pnpm db:setup`. Password **Passw0rd!**.

Two layers: **UI path** (what the user sees) and **event path** (OpenPanel when `analytics.openpanel` or `VITE_OPENPANEL_ENABLED` is on **and** `VITE_OPENPANEL_CLIENT_ID` is set).

## Discovery (anonymous, SEO-shaped)

- **FUNNEL-01** Home shelf → book detail: card click lands on `/books/:id` with that title; Back returns to `/`.
- **FUNNEL-02** Home “See all” → `/search?category=…` → pick a result → book detail. Category label on the book matches the shelf.
- **FUNNEL-03** Search `q` (title or author from seed) → ≥1 card → book. Empty `q` that matches nothing shows “No listed books match that search.” and the funnel stops (no fake product).

## Conversion — logged-out

- **FUNNEL-04** Anonymous book → “Sign in to buy” → `/signin` (not checkout). After `buyer` login, SPA sends the user to **Home** (`<Navigate to="/" />`), **not** back to the book — assert this drop-off (or a return URL if you add one).
- **FUNNEL-05** Anonymous book → Sign up → new `user` is logged in on Home, not on the book; `/inventory` still shows the shop-role warning.
- **FUNNEL-06** Superadmin on public `/signin` is rejected; funnel does not enter checkout.

## Conversion — buyer (demo pay)

- **FUNNEL-07** `buyer` Search → book in stock → Buy (demo, no Stripe) → `/orders?paid=1` with “Payment recorded.” and the title in My orders.
- **FUNNEL-08** Repeat Buy with the same Idempotency-Key does not duplicate the order (stock/orders stay consistent).
- **FUNNEL-09** Sold-out (`stock < 1`): Buy disabled; user cannot complete checkout.
- **FUNNEL-10** Stripe mode: Buy → `checkoutUrl` redirect; cancel returns to the book; success `/orders?paid=1`.

## Shop publish (catalog funnel)

- **FUNNEL-11** Shop user lists a new book on `/inventory` → it appears on Search and (if category shelf has room) Home; unlisting removes it from those surfaces but `/books/:id` may still open.

## Analytics (OpenPanel)

Start OpenPanel (`make up services=openpanel`), set client id, enable the flag, restart the public app. Dashboard http://localhost:3350.

- **FUNNEL-12** Flag **off**: no ingest to `:3350/api` during home/search/book/checkout.
- **FUNNEL-13** Flag **on**: page views fire on route changes; custom events in order for a full buyer purchase: `search` → `book_viewed` → `checkout_started` → `checkout_completed` (`method: return` on `/orders?paid=1`).
- **FUNNEL-14** Sign-up path: `signup_completed` then `book_viewed` / `checkout_*` if they buy. Login path: `login` `{ method: "password" }` (or `oauth_google`).
- **FUNNEL-15** Identify on login includes id and role; logout `clear`s. Admin session `login` `{ method: "session" }` is **not** part of the public purchase funnel.
- **FUNNEL-16** OpenPanel UI funnel `signup_completed` → `book_viewed` → `checkout_started` → `checkout_completed` shows a drop-off at login-from-book (**FUNNEL-04**) unless you complete search/buy while already signed in.
