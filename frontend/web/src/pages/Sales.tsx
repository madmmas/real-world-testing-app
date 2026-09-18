import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { OrderListItem, StoreSummary } from "@rwa/shared";
import { useAuth } from "../auth";
import { money } from "../money";

export default function Sales() {
  const { apiJson } = useAuth();
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [ready, setReady] = useState(false);
  const [orders, setOrders] = useState<OrderListItem[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const [storeBody, salesBody] = await Promise.all([
          apiJson<{ store: StoreSummary | null }>("/me/store"),
          apiJson<{ orders: OrderListItem[] }>("/me/sales"),
        ]);
        setStore(storeBody.store);
        setOrders(salesBody.orders);
      } catch {
        setStore(null);
        setOrders([]);
      } finally {
        setReady(true);
      }
    })();
  }, [apiJson]);

  if (!ready) return <p className="text-slate-500">Loading…</p>;

  if (!store) {
    return (
      <p className="text-slate-600">
        Open a shop on <Link className="text-blue-600 underline" to="/store">My store</Link> to see sales.
      </p>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">Sales</h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-medium">{order.title}</p>
            <p className="text-sm text-slate-500">
              Buyer @{order.storeName} · {order.status} · {money(order.totalCents)}
            </p>
          </article>
        ))}
        {orders.length === 0 && <p className="text-slate-500">No sales yet.</p>}
      </div>
    </div>
  );
}
