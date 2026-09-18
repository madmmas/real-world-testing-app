import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ANALYTICS_EVENTS, type OrderListItem } from "@rwa/shared";
import { track } from "@rwa/app-client";
import { useAuth } from "../auth";
import { money } from "../money";

export default function Orders() {
  const { apiJson } = useAuth();
  const [params] = useSearchParams();
  const [orders, setOrders] = useState<OrderListItem[]>([]);

  useEffect(() => {
    void apiJson<{ orders: OrderListItem[] }>("/me/orders").then((data) => setOrders(data.orders));
  }, [apiJson]);

  useEffect(() => {
    if (params.get("paid") !== "1") return;
    track(ANALYTICS_EVENTS.checkoutCompleted, { method: "return" });
  }, [params]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-semibold">My orders</h2>
      {params.get("paid") && (
        <p className="mb-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">Payment recorded.</p>
      )}
      <div className="space-y-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-xl bg-white p-4 shadow-sm">
            <p className="font-medium">{order.title}</p>
            <p className="text-sm text-slate-500">
              {order.storeName} · {order.status} · {money(order.totalCents)}
            </p>
          </article>
        ))}
        {orders.length === 0 && <p className="text-slate-500">No purchases yet.</p>}
      </div>
    </div>
  );
}
