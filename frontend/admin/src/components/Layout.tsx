import { NavLink, Outlet } from "react-router-dom";
import { ROLE_LABELS, canAccessAdminSection, type AdminSection } from "@rwa/shared";
import { useAuth } from "../auth";

const link = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm ${isActive ? "bg-slate-800 text-white" : "text-slate-300 hover:bg-slate-800"}`;

const NAV: { to: string; label: string; section: AdminSection }[] = [
  { to: "/", label: "Overview", section: "stats" },
  { to: "/users", label: "Users", section: "users" },
  { to: "/stores", label: "Stores", section: "stores" },
  { to: "/books", label: "Books", section: "books" },
  { to: "/orders", label: "Orders", section: "orders" },
  { to: "/audit", label: "Audit", section: "audit" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const role = user?.role ?? "";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[14rem_1fr]">
      <aside className="bg-slate-900 p-6 text-slate-100">
        <p className="mb-1 font-semibold">Admin</p>
        <p className="text-sm text-slate-400">@{user?.username}</p>
        <p className="mb-6 text-xs text-slate-500">{user ? ROLE_LABELS[user.role] : ""}</p>
        <nav className="space-y-1">
          {NAV.filter((item) => canAccessAdminSection(role, item.section)).map((item) => (
            <NavLink key={item.to} to={item.to} className={link} end={item.to === "/"}>
              {item.label}
            </NavLink>
          ))}
          <button
            className="mt-4 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800"
            onClick={() => void logout()}
          >
            Logout
          </button>
        </nav>
      </aside>
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
