# UI E2E — Public site (`frontend/web`, :3000)

Unleash `analytics.openpanel` / `VITE_OPENPANEL_ENABLED` only affects tracking, not catalog.

## Anonymous

- **E2E-PUB-01** Home shows category shelves from `frontpage`; empty category is omitted.
- **E2E-PUB-02** Search page query/filters update results; empty state when nothing matches.
- **E2E-PUB-03** Book detail shows title, author, price, cover; CTA to buy if listed.
- **E2E-PUB-04** Buy / orders / settings / inventory while logged out → redirect to `/signin`.
- **E2E-PUB-05** Nav links: Home, Search, Sign in, Sign up.

## Auth

- **E2E-PUB-06** Sign in as `buyer` / `Passw0rd!` (Altcha may be invisible) → lands authenticated; refresh stays logged in (sessionStorage refresh token).
- **E2E-PUB-07** Wrong password → error; after 5 failures UI switches toward interactive captcha if the API signals it.
- **E2E-PUB-08** Sign up new user → logged in as `user`; inventory/store still blocked.
- **E2E-PUB-09** Sign in as `superadmin` on the public site → rejected (admin console only).
- **E2E-PUB-10** Google button visible only if `/auth/oauth/providers` says google; callback `/signin/callback` stores tokens from hash.
- **E2E-PUB-11** Logout clears session; protected routes redirect.

## Buyer

- **E2E-PUB-12** Settings load and save profile fields.
- **E2E-PUB-13** Book detail checkout as buyer: demo mode completes without Stripe redirect; orders page lists the order.
- **E2E-PUB-14** Stripe mode: redirect to Checkout (or mock); cancel URL returns to book; success `/orders?paid=1`.
- **E2E-PUB-15** Buyer visiting `/inventory` or `/store` sees shop-role message, not the seller tools.

## Shop

Covered in [shop.md](shop.md).

## Flags / analytics

- **E2E-PUB-16** With OpenPanel flag off, no events to `:3350/api` (network). Flag on + client id → events on search/view/checkout as wired.
- **E2E-PUB-17** Search still works with Elasticsearch flag off and on (results may differ).
