# Visual regression — Shop seller tools (`frontend/web`)

Shop JWT (`role: shop`). Username is printed at seed. Mask one-time API key plaintext, Stripe account ids, and live order timestamps.

Capture **1280×800** unless noted. Header for a shop user must include Sell, Sales, Store plus the “Shop user” role label.

- **VRT-SHOP-01** `/store` with an existing store: name, slug, Stripe status, Connect CTA, API key list (prefix only).
- **VRT-SHOP-02** `/store` create-store empty state (fresh shop with no store): name field + primary create button.
- **VRT-SHOP-03** `/store` after creating a key: one-time plaintext shown once (mask the secret; assert layout: copyable value, revoke).
- **VRT-SHOP-04** `/inventory`: book table/cards with title, author, price, stock, category, status; create-book form visible.
- **VRT-SHOP-05** `/inventory` empty store: empty list + create form only.
- **VRT-SHOP-06** `/sales` with the seeded paid order: order rows (mask ids/dates); empty sales if you clear orders.
- **VRT-SHOP-07** Stripe Connect without keys: demo/error copy on `/store` (no live Stripe iframe).
- **VRT-SHOP-08** Mobile 375px `/inventory`: form and list stack; header nav wraps without covering the table.
- **VRT-SHOP-09** Buyer deep-link `/inventory`: amber warning (same as **VRT-PUB-14**); shop header is absent.
