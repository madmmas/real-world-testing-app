# API — Sales (`sales-service`, port 3007)

Checkout is JWT-authenticated. Fulfillment is internal (webhook → payment → `/internal/fulfill/:id`).

## Checkout

- **API-SALES-01** Buyer JWT `POST /checkout` with a listed in-stock `bookId` + quantity → order created; demo mode (`STRIPE_SECRET_KEY` unset) may mark paid locally and return `checkoutUrl: null`.
- **API-SALES-02** Checkout without JWT → 401.
- **API-SALES-03** Shop JWT buying their own listed book — **reject** (`You cannot buy from your own store`).
- **API-SALES-04** Quantity 0, negative, or non-numeric → 400.
- **API-SALES-05** Book not listed / stock 0 / unknown id → 4xx, stock unchanged.
- **API-SALES-06** Concurrent checkouts for last item: only one succeeds; stock never negative.
- **API-SALES-07** Platform fee is `round(total * PLATFORM_FEE_BPS / 10000)` (default 10%).
- **API-SALES-08** With Stripe enabled and seller onboarded → `checkoutUrl` to Stripe; order stays unpaid until webhook.

## Buyer / seller lists

- **API-SALES-09** `GET /me/orders` as buyer → their orders only.
- **API-SALES-10** `GET /me/sales` as shop → their store’s orders; as buyer → 403.
- **API-SALES-11** Pagination/order of lists is stable enough to assert in a seed DB.

## Admin

- **API-SALES-12** `GET /admin/orders` as superadmin or sales → 200; marketing → 403.
- **API-SALES-13** `GET /admin/stats` as sales/superadmin → 200; marketing → 403.

## Internal

- **API-SALES-14** `POST /internal/fulfill/:id` with secret on a pending Stripe order → paid + stock committed as implemented.
- **API-SALES-16** Repeat `POST /checkout` with the same `Idempotency-Key` → one order and the same JSON.
- **API-SALES-17** Same key with a different `bookId` or quantity → 409.
- **API-SALES-19** `POST /internal/checkout` with secret, `buyerId`, and cart `items` creates one order per store (demo) or rejects mixed stores in Stripe mode.
