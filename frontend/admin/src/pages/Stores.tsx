import { useEffect, useState } from "react";
import { useAuth } from "../auth";

type Row = {
  id: string;
  name: string;
  slug: string;
  stripeOnboarded: boolean;
  bookCount: number;
  orderCount: number;
};

export default function Stores() {
  const { apiFetch } = useAuth();
  const [stores, setStores] = useState<Row[]>([]);

  useEffect(() => {
    void apiFetch("/api/admin/stores")
      .then((res) => res.json())
      .then((body) => setStores(body.stores ?? []));
  }, [apiFetch]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Stores</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2">Name</th>
            <th>Slug</th>
            <th>Books</th>
            <th>Orders</th>
            <th>Stripe</th>
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => (
            <tr key={store.id} className="border-b border-slate-100">
              <td className="py-2">{store.name}</td>
              <td>{store.slug}</td>
              <td>{store.bookCount}</td>
              <td>{store.orderCount}</td>
              <td>{store.stripeOnboarded ? "ready" : "not onboarded"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
