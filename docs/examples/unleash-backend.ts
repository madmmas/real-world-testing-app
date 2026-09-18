/**
 * Example only — copy into a backend service (sales-service is the usual home
 * for checkout). Not imported by the running app.
 *
 *   pnpm --filter @rwa/sales-service add unleash-client
 */
import { startUnleash, type Unleash, type Context } from "unleash-client";

export const FLAG_STRIPE_CHECKOUT = "example.stripe-checkout";

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

export function isFlagEnabled(
  unleash: Unleash | null,
  name: string,
  context: Context = {}
): boolean {
  if (!unleash) return false;
  return unleash.isEnabled(name, context);
}

/** JWT payload already on AuthedRequest.user after requireJwt. */
export function stripeCheckoutEnabled(
  unleash: Unleash | null,
  user: { sub: string; username: string }
): boolean {
  return isFlagEnabled(unleash, FLAG_STRIPE_CHECKOUT, {
    userId: user.sub,
    properties: { username: user.username },
  });
}

/*
  backend/sales-service/src/index.ts (sketch)

  const unleash = await createUnleash("sales-service");

  app.post("/checkout", auth, async (req, res) => {
    const buyer = await requireBuyer(req, res);
    if (!buyer) return;
    const useStripe = stripeCheckoutEnabled(unleash, req.user!);
    // if (useStripe) { payment-service Stripe session }
    // else { existing local paid-order path }
  });
*/
