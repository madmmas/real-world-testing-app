# Unleash examples

Local feature flags for this repo. The Unleash UI stores toggles. The **Node SDK** evaluates them in backends (authoritative). The **React SDK** evaluates them in the public and admin apps (UI only).

These snippets are examples, except **OpenPanel** (`analytics.openpanel` on the frontends), **Elasticsearch search** (`search.elasticsearch` in catalog-service), **OpenTelemetry** (`observability.opentelemetry` in every backend), and **Altcha** (`auth.altcha` in auth-service; default on). Env can allow or deny those same features (`VITE_OPENPANEL_ENABLED`, `ELASTICSEARCH_SEARCH_ENABLED`, `OTEL_ENABLED`, `ALTCHA_ENABLED` / `VITE_ALTCHA_ENABLED`). See [openpanel.md](openpanel.md), [elasticsearch.md](elasticsearch.md), and [observability.md](observability.md).

| | |
| --- | --- |
| UI | http://localhost:4242 |
| Login | `admin` / `unleash4all` |
| Backend API | `http://localhost:4242/api/` |
| Frontend API | `http://localhost:4242/api/frontend` |
| Backend token | `default:development.unleash-insecure-api-token` |
| Frontend token | `default:development.unleash-insecure-frontend-api-token` |

The tokens match `INIT_*` in `docker-compose.yml`. They are created on **first** Unleash boot only. After that, copy tokens from **Admin → API access** in the UI.

Do not use these tokens outside local Docker.

## Start Unleash

Postgres must be up. Unleash stores its tables in schema `unleash` on the same database Prisma uses (`public` is untouched). Compose creates that schema before Unleash is considered healthy; Unleash 8 will crash-loop if the schema is missing.

```bash
make db
make up services=unleash
```

`make up` also starts Unleash with the other backends. Logs: `make logs services=unleash`.

Open http://localhost:4242 and sign in.

## Create the example flag

1. **New feature toggle**.
2. Name it `example.stripe-checkout` (the SDK uses this string).
3. Type: **Release**. Project: **Default**. Environment: **development**.
4. Enable it in **development**.

Same flag, two sides: the public site can show a Stripe badge; **order-service** decides whether checkout actually calls Stripe. Never trust the frontend flag for payment or auth.

Optional UI-only flag: `example.web.reviews` — a reviews block on the book page. Safe to evaluate only in React.

## Backend (Node)

Install in the service that owns the decision. Checkout belongs to order-service:

```bash
pnpm --filter @rwa/order-service add unleash-client
```

Env (already in `.env.example`):

| Variable | Host | Inside Compose |
| --- | --- | --- |
| `UNLEASH_URL` | `http://localhost:4242/api/` | `http://unleash:4242/api/` |
| `UNLEASH_API_TOKEN` | backend token above | same token |

Compose already sets the in-network URL on every backend.

Drop-in files: [examples/unleash-backend.ts](examples/unleash-backend.ts).

### 1. Start the client once

```ts
import { startUnleash, type Unleash } from "unleash-client";

const FLAG_STRIPE_CHECKOUT = "example.stripe-checkout";

export async function createUnleash(appName: string): Promise<Unleash | null> {
  const url = process.env.UNLEASH_URL;
  const token = process.env.UNLEASH_API_TOKEN;
  if (!url || !token) return null;

  return startUnleash({
    url,
    appName,
    customHeaders: { Authorization: token },
  });
}

export function stripeCheckoutEnabled(
  unleash: Unleash | null,
  user: { sub: string; username: string }
) {
  if (!unleash) return false; // fail closed if Unleash is unset or down
  return unleash.isEnabled(FLAG_STRIPE_CHECKOUT, {
    userId: user.sub,
    properties: { username: user.username },
  });
}
```

`startUnleash` waits until the first fetch succeeds. Call it at boot, before `listen`. If Unleash is down, skip starting it and keep the flag off.

### 2. Gate checkout in order-service

In `backend/order-service/src/index.ts`, next to the existing `POST /checkout` handler (the branch that calls payment-service vs local demo pay):

```ts
const unleash = await createUnleash("order-service");

app.post("/checkout", auth, async (req: AuthedRequest, res) => {
  const buyer = await requireBuyer(req, res);
  if (!buyer) return;

  const useStripe = stripeCheckoutEnabled(unleash, req.user!);
  // existing catalog + order insert …

  if (useStripe) {
    // existing Stripe session via payment-service
  } else {
    // existing local paid-order path
  }
});
```

Variants (A/B copy, rollout percentage) use `unleash.getVariant(name, context)`. `variant.enabled` is the on/off; `variant.payload?.value` is the payload.

### Context

Pass who the user is. Unleash strategies (user ids, gradual rollout, constraints) need it.

| Field | Use |
| --- | --- |
| `userId` | JWT `sub` |
| `properties.username` | JWT `username` |
| `properties.role` | `user` / `shop` / admin role from auth-service if you load it |
| `properties.storeId` | shop checkout or inventory flags |

Anonymous GraphQL traffic: omit `userId`, or use a hashed IP only if you have a gradual-rollout strategy that needs a stickiness id.

## Frontend (React)

Install in each Vite app that should read flags:

```bash
pnpm --filter @rwa/web add @unleash/proxy-client-react unleash-proxy-client
pnpm --filter @rwa/admin add @unleash/proxy-client-react unleash-proxy-client
```

Vite only loads `.env` from the app directory (`frontend/web`, `frontend/admin`), not the repo root. Put these in both apps’ `.env`:

```
VITE_UNLEASH_URL=http://localhost:4242/api/frontend
VITE_UNLEASH_CLIENT_KEY=default:development.unleash-insecure-frontend-api-token
```

Drop-in files: [examples/unleash-frontend.tsx](examples/unleash-frontend.tsx).

### 1. Wrap the tree

`frontend/web/src/main.tsx` (admin: `frontend/admin/src/main.tsx`, `appName: "admin"`):

```tsx
import { FlagProvider } from "@unleash/proxy-client-react";
import { AuthProvider } from "./auth";
import App from "./App";

const unleashConfig = {
  url: import.meta.env.VITE_UNLEASH_URL ?? "http://localhost:4242/api/frontend",
  clientKey:
    import.meta.env.VITE_UNLEASH_CLIENT_KEY ??
    "default:development.unleash-insecure-frontend-api-token",
  refreshInterval: 15,
  appName: "web",
};

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FlagProvider config={unleashConfig}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </FlagProvider>
  </React.StrictMode>
);
```

### 2. Use a flag in a page

`frontend/web/src/pages/BookDetail.tsx`, next to the Buy button:

```tsx
import { useFlag } from "@unleash/proxy-client-react";

export default function BookDetail() {
  const stripeCheckout = useFlag("example.stripe-checkout");
  const reviews = useFlag("example.web.reviews");

  return (
    <article>
      {/* existing title, price, Buy button */}
      {stripeCheckout && (
        <p className="mt-2 text-sm text-slate-500">Checkout uses Stripe when the shop is connected.</p>
      )}
      {reviews && (
        <section className="mt-8 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Reviews</h3>
          <p className="mt-1 text-sm text-slate-600">No reviews yet. This block is behind example.web.reviews.</p>
        </section>
      )}
    </article>
  );
}
```

`useFlag` returns `false` until the first frontend-API response. That is the same fail-closed default as the backend helper.

### 3. Send the signed-in user (optional)

After login, update Unleash context so percentage rollouts stick to a buyer:

```tsx
import { useUnleashContext } from "@unleash/proxy-client-react";

function UnleashUserSync() {
  const { user } = useAuth();
  const updateContext = useUnleashContext();

  useEffect(() => {
    void updateContext(
      user
        ? { userId: user.id, properties: { username: user.username, role: user.role } }
        : {}
    );
  }, [user, updateContext]);

  return null;
}
```

Render `<UnleashUserSync />` inside `AuthProvider`.

Admin console: same `FlagProvider`, `appName: "admin"`. Example: hide a dashboard chart with `useFlag("example.admin.new-dashboard")`. Still do not use that for authorization — admin routes stay role-gated in REST.

## Frontend vs backend

| Kind of change | Where the flag is checked |
| --- | --- |
| Copy, layout, hide a reviews block | React `useFlag` |
| Stripe vs demo checkout, inventory write, API key create | Node `isEnabled` on the service that performs the write |
| Both a badge and a real payment change | Same flag name, **backend enforces** |

If Unleash is down: UI hides the new bit; API keeps the old path (`false`).

## SDK docs

- Node: https://docs.getunleash.io/sdks/node
- React: https://docs.getunleash.io/sdks/react
