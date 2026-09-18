/**
 * Example only — copy into frontend/web (and frontend/admin with appName: "admin").
 * Not imported by the running app.
 *
 *   pnpm --filter @rwa/web add @unleash/proxy-client-react unleash-proxy-client
 *
 * Vite loads env from frontend/web/.env (not the repo root):
 *
 *   VITE_UNLEASH_URL=http://localhost:4242/api/frontend
 *   VITE_UNLEASH_CLIENT_KEY=default:development.unleash-insecure-frontend-api-token
 */
import { useEffect, type ReactNode } from "react";
import { FlagProvider, useFlag, useUnleashContext } from "@unleash/proxy-client-react";

export const FLAG_STRIPE_CHECKOUT = "example.stripe-checkout";
export const FLAG_WEB_REVIEWS = "example.web.reviews";

export const webUnleashConfig = {
  url: import.meta.env.VITE_UNLEASH_URL ?? "http://localhost:4242/api/frontend",
  clientKey:
    import.meta.env.VITE_UNLEASH_CLIENT_KEY ??
    "default:development.unleash-insecure-frontend-api-token",
  refreshInterval: 15,
  appName: "web",
};

/** Wrap around BrowserRouter in frontend/web/src/main.tsx */
export function WebFlagRoot({ children }: { children: ReactNode }) {
  return <FlagProvider config={webUnleashConfig}>{children}</FlagProvider>;
}

/**
 * Render inside AuthProvider. Stickiness for percentage rollouts.
 * `user` shape matches PublicUser from @rwa/shared.
 */
export function UnleashUserSync({
  user,
}: {
  user: { id: string; username: string; role: string } | null;
}) {
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

/** Drop into frontend/web/src/pages/BookDetail.tsx next to the Buy button */
export function BookDetailFlagBits() {
  const stripeCheckout = useFlag(FLAG_STRIPE_CHECKOUT);
  const reviews = useFlag(FLAG_WEB_REVIEWS);

  return (
    <>
      {stripeCheckout && (
        <p className="mt-2 text-sm text-slate-500">
          Checkout uses Stripe when the shop is connected.
        </p>
      )}
      {reviews && (
        <section className="mt-8 rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold">Reviews</h3>
          <p className="mt-1 text-sm text-slate-600">
            No reviews yet. This block is behind {FLAG_WEB_REVIEWS}.
          </p>
        </section>
      )}
    </>
  );
}
