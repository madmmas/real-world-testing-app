# UI E2E — Shop seller tools (`frontend/web`)

Shop JWT (`role: shop`). Username printed at seed.

- **E2E-SHOP-01** `/store`: create store with a name; page shows slug and Stripe status.
- **E2E-SHOP-02** Second store create for the same user is blocked or no-op (assert UI copy).
- **E2E-SHOP-03** Stripe Connect button: with keys, redirect to Stripe; without keys, demo/error copy.
- **E2E-SHOP-04** `/inventory`: create a book (title, author, price, stock, category) → appears in list and on public search when listed.
- **E2E-SHOP-05** Update book status/category from inventory; public catalog reflects it.
- **E2E-SHOP-06** `/sales` lists orders for this store after a buyer checkout.
- **E2E-SHOP-07** API keys on store page: create shows plaintext once; revoke stops partner GraphQL search.
- **E2E-SHOP-08** Buyer account cannot complete seller flows even via deep link.
