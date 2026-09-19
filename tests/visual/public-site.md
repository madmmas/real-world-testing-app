# Visual regression — Public site (`frontend/web`, :3000)

Use Playwright `toHaveScreenshot`, Percy, Chromatic, or Backstop. Compare against a committed baseline after `pnpm db:setup` (Faker seed `20260917`, so catalog copy is stable). HTTPS is self-signed; ignore TLS in the browser.

Mask or freeze anything that still moves: book covers (`/media/` or Dicebear), timestamps, order ids, captcha canvas, and Unleash/OpenPanel widgets. Wait for fonts and cover images before capture. Capture **full page** unless the case says viewport only.

Default viewports: **1280×800**, **768×1024**, **375×812**. Run desktop unless a case names another size.

## Anonymous

- **VRT-PUB-01** Home `/`: category shelves, “See all” links, demo Stripe banner (amber) when checkout is local. Header shows Home, Search, Sign in, Sign up.
- **VRT-PUB-02** Home with `STRIPE_SECRET_KEY` set: demo banner gone; shelves unchanged.
- **VRT-PUB-03** Home empty catalog (no listed books): “No listed books yet.”; no empty category rows.
- **VRT-PUB-04** Search `/search` with a matching query: filters + result cards (cover, title, author, price).
- **VRT-PUB-05** Search empty: empty-state copy, no leftover cards.
- **VRT-PUB-06** Book detail `/books/:id` for a listed title: cover, title, author, price, buy CTA.
- **VRT-PUB-07** Sign in `/signin`: card layout, username/password, invisible Altcha (no checkbox), Google block off or on per `/auth/oauth/providers`.
- **VRT-PUB-08** Sign up `/signup`: same card language as sign-in (blue heading, white card, shadow).
- **VRT-PUB-09** Forgot `/forgot` and reset `/reset?token=dead`: form + any invalid-token error.
- **VRT-PUB-10** Mobile 375px: home header wraps; shelves scroll horizontally; sign-in card still centered.

## Auth and errors

- **VRT-PUB-11** Signed in as `buyer`: header shows Orders, Account, role label “Authenticated user”, Logout; no Sell/Sales/Store.
- **VRT-PUB-12** Sign-in error after wrong password: red error banner; layout otherwise unchanged.
- **VRT-PUB-13** After 5 failed passwords: interactive Altcha checkbox + “Too many failed sign-ins…” copy.
- **VRT-PUB-14** Buyer `/inventory` (and `/store`): amber shop-role warning, not seller forms.

## Buyer pages

- **VRT-PUB-15** Settings `/settings`: profile fields populated for `buyer`.
- **VRT-PUB-16** Orders `/orders` after a demo checkout: at least one row; empty orders if none.
- **VRT-PUB-17** Book detail as buyer: buy CTA enabled for listed stock; sold-out/unlisted treatment if you seed that state.

## Stability

- **VRT-PUB-18** Same page twice after reload: pixel diff only inside masked regions (covers, captcha).
- **VRT-PUB-19** Home at 1280 vs 768: shelves reflow; no overlapping nav or clipped heading.
