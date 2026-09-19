import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ANALYTICS_EVENTS } from "@rwa/shared";
import { track } from "@rwa/app-client";
import { useAuth } from "../auth";
import { useCart } from "../cart";
import { money } from "../money";

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, ready, setQuantity, remove, checkout } = useCart();
  const [error, setError] = useState("");
  const [paying, setPaying] = useState(false);
  const checkoutKey = useRef(crypto.randomUUID());

  async function pay() {
    if (!user) {
      navigate("/signin?next=/cart");
      return;
    }
    setError("");
    setPaying(true);
    try {
      track(ANALYTICS_EVENTS.checkoutStarted, {
        cartId: cart.id,
        itemCount: cart.itemCount,
        totalCents: cart.totalCents,
      });
      const data = await checkout(checkoutKey.current);
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      navigate("/orders?paid=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setPaying(false);
    }
  }

  if (!ready) return <p className="text-slate-500">Loading…</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Cart</h2>
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <div className="space-y-3">
        {cart.items.map((item) => (
          <article key={item.bookId} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
            {item.coverUrl ? (
              <img src={item.coverUrl} alt={item.title} className="h-24 w-20 rounded-md object-cover" />
            ) : (
              <div className="h-24 w-20 rounded-md bg-slate-100" />
            )}
            <div className="min-w-0 flex-1">
              <Link className="font-medium hover:underline" to={`/books/${item.bookId}`}>
                {item.title}
              </Link>
              <p className="text-sm text-slate-500">
                {item.author} · {item.storeName}
              </p>
              <p className="mt-1 font-semibold">{money(item.unitPriceCents)}</p>
              {!item.available && (
                <p className="mt-1 text-sm text-red-700">This title is no longer available at this quantity.</p>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <label className="text-sm text-slate-600">
                  Qty
                  <input
                    className="ml-2 w-16 rounded-md border border-slate-300 px-2 py-1"
                    type="number"
                    min={1}
                    max={Math.max(1, item.stock)}
                    value={item.quantity}
                    onChange={(event) => {
                      const quantity = Number(event.target.value);
                      if (!Number.isFinite(quantity)) return;
                      void setQuantity(item.bookId, quantity).catch((err) =>
                        setError(err instanceof Error ? err.message : "Could not update cart")
                      );
                    }}
                  />
                </label>
                <button
                  className="text-sm text-slate-600 underline"
                  type="button"
                  onClick={() => void remove(item.bookId)}
                >
                  Remove
                </button>
              </div>
            </div>
          </article>
        ))}
        {cart.items.length === 0 && <p className="text-slate-500">Your cart is empty.</p>}
      </div>
      {cart.items.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
          <p className="text-lg font-semibold">Total {money(cart.totalCents)}</p>
          <button
            className="rounded-md bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50"
            disabled={paying || cart.items.some((item) => !item.available)}
            onClick={() => void pay()}
          >
            {paying ? "Working…" : user ? "Pay" : "Sign in to pay"}
          </button>
        </div>
      )}
    </div>
  );
}
