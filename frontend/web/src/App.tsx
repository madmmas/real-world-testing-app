import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import OAuthCallback from "./pages/OAuthCallback";
import Home from "./pages/Home";
import Search from "./pages/Search";
import BookDetail from "./pages/BookDetail";
import Inventory from "./pages/Inventory";
import StorePage from "./pages/StorePage";
import Orders from "./pages/Orders";
import Sales from "./pages/Sales";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Settings from "./pages/Settings";

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

function ShopGuard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/signin" replace />;
  if (user.role !== "shop") {
    return (
      <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
        Selling tools are limited to shop users. Ask a sales or superadmin to grant the shop role.
      </p>
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/books/:id" element={<BookDetail />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signin/callback" element={<OAuthCallback />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/reset" element={<ResetPassword />} />
        <Route
          path="/inventory"
          element={
            <Guard>
              <ShopGuard>
                <Inventory />
              </ShopGuard>
            </Guard>
          }
        />
        <Route
          path="/store"
          element={
            <Guard>
              <ShopGuard>
                <StorePage />
              </ShopGuard>
            </Guard>
          }
        />
        <Route
          path="/orders"
          element={
            <Guard>
              <Orders />
            </Guard>
          }
        />
        <Route
          path="/sales"
          element={
            <Guard>
              <ShopGuard>
                <Sales />
              </ShopGuard>
            </Guard>
          }
        />
        <Route
          path="/settings"
          element={
            <Guard>
              <Settings />
            </Guard>
          }
        />
      </Route>
    </Routes>
  );
}
