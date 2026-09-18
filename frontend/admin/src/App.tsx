import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { canAccessAdminSection, type AdminSection } from "@rwa/shared";
import { useAuth } from "./auth";
import Layout from "./components/Layout";
import SignIn from "./pages/SignIn";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Stores from "./pages/Stores";
import Books from "./pages/Books";
import Orders from "./pages/Orders";
import Audit from "./pages/Audit";

function Guard({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="p-10 text-center text-slate-500">Loading…</div>;
  if (!user) return <Navigate to="/signin" replace />;
  return children;
}

function Section({ section, children }: { section: AdminSection; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !canAccessAdminSection(user.role, section)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/signin" element={<SignIn />} />
      <Route
        element={
          <Guard>
            <Layout />
          </Guard>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route
          path="/users"
          element={
            <Section section="users">
              <Users />
            </Section>
          }
        />
        <Route
          path="/stores"
          element={
            <Section section="stores">
              <Stores />
            </Section>
          }
        />
        <Route
          path="/books"
          element={
            <Section section="books">
              <Books />
            </Section>
          }
        />
        <Route
          path="/orders"
          element={
            <Section section="orders">
              <Orders />
            </Section>
          }
        />
        <Route
          path="/audit"
          element={
            <Section section="audit">
              <Audit />
            </Section>
          }
        />
      </Route>
    </Routes>
  );
}
