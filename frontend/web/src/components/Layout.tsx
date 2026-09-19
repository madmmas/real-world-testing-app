import { NavLink, Outlet } from "react-router-dom";
import { ROLE_LABELS } from "@rwa/shared";
import { useAuth } from "../auth";
import { useCart } from "../cart";

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm ${isActive ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"}`;

export default function Layout() {
  const { user, logout } = useAuth();
  const { cart } = useCart();
  const isShop = user?.role === "shop";

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
          <NavLink to="/" className="text-lg font-semibold text-blue-700">
            Books Library
          </NavLink>
          <nav className="flex flex-wrap items-center gap-1">
            <NavLink to="/" className={link} end>
              Home
            </NavLink>
            <NavLink to="/search" className={link}>
              Search
            </NavLink>
            <NavLink to="/cart" className={link}>
              Cart{cart.itemCount > 0 ? ` (${cart.itemCount})` : ""}
            </NavLink>
            {user ? (
              <>
                <NavLink to="/orders" className={link}>
                  Orders
                </NavLink>
                {isShop && (
                  <>
                    <NavLink to="/inventory" className={link}>
                      Sell
                    </NavLink>
                    <NavLink to="/sales" className={link}>
                      Sales
                    </NavLink>
                    <NavLink to="/store" className={link}>
                      Store
                    </NavLink>
                  </>
                )}
                <NavLink to="/settings" className={link}>
                  Account
                </NavLink>
                <span className="px-2 text-xs text-slate-500">{ROLE_LABELS[user.role]}</span>
                <button
                  className="rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
                  onClick={() => void logout()}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <NavLink to="/signin" className={link}>
                  Sign in
                </NavLink>
                <NavLink to="/signup" className="rounded-md bg-blue-600 px-3 py-2 text-sm text-white">
                  Sign up
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
