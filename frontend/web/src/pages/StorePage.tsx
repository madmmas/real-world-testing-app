import { FormEvent, useEffect, useState } from "react";
import type { StoreSummary } from "@rwa/shared";
import { useAuth } from "../auth";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export default function StorePage() {
  const { apiJson } = useAuth();
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [plaintext, setPlaintext] = useState("");
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    try {
      const storeBody = await apiJson<{ store: StoreSummary | null }>("/me/store");
      setStore(storeBody.store);
      const [configRes, keysBody] = await Promise.all([
        fetch("/config").catch(() => null),
        apiJson<{ keys: ApiKeyRow[] }>("/me/keys").catch(() => ({ keys: [] })),
      ]);
      if (configRes?.ok) {
        const config = (await configRes.json()) as { stripeEnabled?: boolean };
        setStripeEnabled(Boolean(config.stripeEnabled));
      }
      setKeys(keysBody.keys);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not load store");
    } finally {
      setReady(true);
    }
  }

  useEffect(() => {
    void load();
  }, [apiJson]);

  async function createStore(event: FormEvent) {
    event.preventDefault();
    try {
      await apiJson("/me/store", { method: "POST", body: JSON.stringify({ name }) });
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Could not create store");
    }
  }

  async function connectStripe() {
    try {
      const data = await apiJson<{ url: string }>("/me/stripe/connect", { method: "POST" });
      window.location.href = data.url;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Stripe Connect is unavailable");
    }
  }

  async function syncStripe() {
    const data = await apiJson<{ store: StoreSummary }>("/me/stripe/sync", { method: "POST" });
    setStore(data.store);
  }

  async function createKey(event: FormEvent) {
    event.preventDefault();
    const data = await apiJson<{ key: { plaintext: string } }>("/me/keys", {
      method: "POST",
      body: JSON.stringify({ name: "Partner search" }),
    });
    setPlaintext(data.key.plaintext);
    await load();
  }

  async function revoke(id: string) {
    await apiJson(`/me/keys/${id}`, { method: "DELETE" });
    await load();
  }

  if (!ready) return <p className="text-slate-500">Loading…</p>;

  if (!store) {
    return (
      <form className="max-w-md space-y-3 rounded-xl bg-white p-6 shadow" onSubmit={(e) => void createStore(e)}>
        <h2 className="text-xl font-semibold">Open a store</h2>
        <p className="text-sm text-slate-500">Each seller gets a shop. Buyers purchase from the marketplace catalog.</p>
        {message && <p className="text-sm text-red-700">{message}</p>}
        <input
          className="w-full rounded-md border border-slate-300 px-3 py-2"
          placeholder="Store name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="rounded-md bg-blue-600 px-4 py-2 text-white" type="submit">
          Create store
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold">{store.name}</h2>
        <p className="text-sm text-slate-500">/{store.slug}</p>
        <p className="mt-3 text-sm">
          Payouts: {store.stripeOnboarded ? "Stripe Connect ready" : "not onboarded"}
        </p>
        {message && <p className="mt-2 text-sm text-red-700">{message}</p>}
        <div className="mt-4 flex gap-2">
          <button
            className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            disabled={!stripeEnabled}
            onClick={() => void connectStripe()}
          >
            Connect Stripe
          </button>
          <button className="rounded-md bg-slate-100 px-4 py-2 text-sm" onClick={() => void syncStripe()}>
            Refresh status
          </button>
        </div>
        {!stripeEnabled && (
          <p className="mt-3 text-sm text-slate-500">
            Set STRIPE_SECRET_KEY to enable Connect onboarding. Local demo checkout still works without it.
          </p>
        )}
      </section>

      <section className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold">Partner API keys</h3>
        <p className="mb-4 text-sm text-slate-500">
          Third-party apps search listed books over GraphQL only: POST /graphql with X-Api-Key and the searchBooks query.
        </p>
        <form onSubmit={(e) => void createKey(e)}>
          <button className="rounded-md bg-slate-800 px-4 py-2 text-sm text-white" type="submit">
            Issue key
          </button>
        </form>
        {plaintext && (
          <p className="mt-3 break-all rounded-md bg-emerald-50 p-3 text-sm">
            Copy now — it will not be shown again: <code>{plaintext}</code>
          </p>
        )}
        <ul className="mt-4 space-y-2">
          {keys.map((key) => (
            <li key={key.id} className="flex items-center justify-between text-sm">
              <span>
                {key.name} · {key.keyPrefix}… {key.revokedAt ? "(revoked)" : ""}
              </span>
              {!key.revokedAt && (
                <button className="text-red-600" onClick={() => void revoke(key.id)}>
                  Revoke
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
