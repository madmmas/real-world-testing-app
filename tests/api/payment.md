# API — Payment (`payment-service`, port 3008)

Public: `GET /config`, `POST /api/stripe/webhook`. Connect/sync are JWT; checkout-sessions are internal.

- **API-PAY-01** `GET /config` no auth → `{ stripeEnabled, checkoutMode: "stripe"|"demo" }`.
- **API-PAY-02** `POST /checkout-sessions` without `x-internal-secret` → 401.
- **API-PAY-03** Internal checkout-sessions with Stripe off → `{ mode: "demo", checkoutUrl: null }`.
- **API-PAY-04** Internal checkout-sessions with Stripe on but seller not onboarded → 400.
- **API-PAY-05** Shop JWT `POST /connect` and `POST /sync` (usually via store-service) require shop role; buyer → 403.
- **API-PAY-06** Webhook without `Stripe-Signature` → 400.
- **API-PAY-07** Webhook with valid signature `checkout.session.completed` → sales fulfill called; invalid secret → 400.
- **API-PAY-08** Webhook `account.updated` with `charges_enabled` updates store `stripeOnboarded`.
- **API-PAY-09** Replay the same Stripe event id → `{ duplicate: true }` and no second fulfill.
