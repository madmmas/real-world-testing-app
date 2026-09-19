# API — Cart (`order-service`, port 3007, Kong `/cart`)

Guest carts use httpOnly cookie `rwa.cart`. Logged-in carts use the access JWT and claim any guest cookie. TTL is `CART_TTL_HOURS` (default 72), sliding on each write/read. Checkout is JWT (`POST /cart/checkout`).

## Guest cart

- **API-CART-01** `POST /cart/items` `{ bookId }` with no JWT → 200 cart JSON + `Set-Cookie: rwa.cart`; cookie is HttpOnly.
- **API-CART-02** Repeat add of the same book increments quantity; over-stock → 400 `Not enough stock`.
- **API-CART-03** `GET /cart` with the cookie returns those lines (`itemCount`, `totalCents`, book title/price).
- **API-CART-04** `PATCH /cart/items/:bookId` `{ quantity: 0 }` (or `DELETE`) removes the line.
- **API-CART-05** Unlisted / unknown book → 400, cart unchanged.
- **API-CART-06** After `CART_TTL_HOURS` with no activity the cart is gone (`GET` is empty / new cookie).

## Assign on login

- **API-CART-07** Guest adds a book, then JWT login + `GET /cart` with cookie and `Authorization` → same lines now belong to that user (`userId` in DB, guest token cleared).
- **API-CART-08** User already has a cart and a guest cookie with other books → quantities merge by `bookId`; guest cart row deleted.
- **API-CART-09** Shop owner adding their own listed book while authenticated → 400 `You cannot buy from your own store`.

## Checkout

- **API-CART-10** `POST /cart/checkout` without JWT → 401.
- **API-CART-11** Buyer JWT, non-empty cart, demo Stripe unset → paid orders + empty cart + `checkoutUrl: null`. Saga for those orders is `completed`.
- **API-CART-12** Empty cart checkout → 400.
- **API-CART-13** Stripe mode, lines from two stores → 400 pay-one-seller; cart unchanged.
- **API-CART-14** Stripe mode, one store, seller onboarded → `checkoutUrl`; cancel returns to `/cart`; success `/orders?paid=1`; webhook clears the cart.
- **API-CART-15** Same `Idempotency-Key` on cart checkout → one order set.

## Internal

- **API-CART-16** `POST /internal/carts/:id/clear` without `x-internal-secret` → 401.
- **API-CART-17** `/internal/*` is not on Kong `:8080`.
