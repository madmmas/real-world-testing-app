import { useEffect, useState } from "react";
import { useAuth } from "../auth";

export default function Dashboard() {
  const { apiFetch } = useAuth();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    void apiFetch("/api/admin/stats")
      .then(async (res) => {
        if (!res.ok) return;
        const body = (await res.json()) as Record<string, unknown>;
        const counts: Record<string, number> = {};
        for (const [key, value] of Object.entries(body)) {
          if (typeof value === "number") counts[key] = value;
        }
        setStats(counts);
      })
      .catch(() => undefined);
  }, [apiFetch]);

  const keys = Object.keys(stats);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {keys.map((key) => (
          <article key={key} className="rounded-xl bg-white p-5 shadow-sm capitalize">
            <p className="text-sm text-slate-500">{key}</p>
            <p className="mt-2 text-3xl font-semibold">{stats[key]}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
