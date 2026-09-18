import { useEffect, useState } from "react";
import { ROLE_LABELS, USER_ROLES, canAssignRole, type UserRole } from "@rwa/shared";
import { useAuth } from "../auth";

type Row = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  role: UserRole;
};

export default function Users() {
  const { user: actor, apiFetch } = useAuth();
  const [users, setUsers] = useState<Row[]>([]);

  async function load() {
    const body = await apiFetch("/api/admin/users").then((res) => res.json());
    setUsers(body.users ?? []);
  }

  useEffect(() => {
    void load();
  }, [apiFetch]);

  async function setRole(user: Row, role: UserRole) {
    if (role === user.role) return;
    await apiFetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    });
    await load();
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Users</h1>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-slate-500">
            <th className="py-2">User</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const options = USER_ROLES.filter(
              (role) => role === user.role || canAssignRole(actor?.role ?? "", user.role, role)
            );
            return (
              <tr key={user.id} className="border-b border-slate-100">
                <td className="py-2">
                  {user.firstName} {user.lastName} (@{user.username})
                </td>
                <td>{user.email}</td>
                <td>
                  {options.length > 0 ? (
                    <select
                      className="rounded-md border border-slate-300 px-2 py-1"
                      value={user.role}
                      onChange={(e) => void setRole(user, e.target.value as UserRole)}
                    >
                      {options.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    ROLE_LABELS[user.role]
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
