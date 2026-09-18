import { useEffect, useState } from "react";
import { useAuth } from "../auth";

type Log = {
  id: string;
  actorId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  meta: unknown;
  createdAt: string;
};

export default function Audit() {
  const { apiFetch } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    void apiFetch("/api/admin/audit")
      .then((res) => res.json())
      .then((body: { logs?: Log[] }) => setLogs(body.logs ?? []));
  }, [apiFetch]);

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Audit log</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2">When</th>
            <th>Action</th>
            <th>Resource</th>
            <th>Actor</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className="border-b border-slate-100">
              <td className="py-2 whitespace-nowrap">{log.createdAt.replace("T", " ").slice(0, 19)}</td>
              <td>{log.action}</td>
              <td>
                {log.resource}
                {log.resourceId ? ` ${log.resourceId.slice(0, 8)}` : ""}
              </td>
              <td className="font-mono text-xs">{log.actorId.slice(0, 8)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 ? <p className="mt-4 text-sm text-slate-500">No audited writes yet.</p> : null}
    </div>
  );
}
