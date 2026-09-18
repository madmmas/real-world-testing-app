import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { money } from "../money";

type Row = {
  id: string;
  status: string;
  totalCents: number;
  platformFeeCents: number;
  storeName: string;
  buyer: string;
  title: string;
};

export default function Orders() {
  const { apiFetch } = useAuth();
  const [orders, setOrders] = useState<Row[]>([]);

  useEffect(() => {
    void apiFetch("/api/admin/orders")
      .then((res) => res.json())
      .then((body) => setOrders(body.orders ?? []));
  }, [apiFetch]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Orders</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2">Title</th>
            <th>Store</th>
            <th>Buyer</th>
            <th>Status</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-b border-slate-100">
              <td className="py-2">{order.title}</td>
              <td>{order.storeName}</td>
              <td>@{order.buyer}</td>
              <td>{order.status}</td>
              <td>{money(order.totalCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
