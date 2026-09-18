import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth";

export default function SignIn() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div className="mx-auto mt-20 max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="mb-1 text-center text-2xl font-bold">Books Library</h1>
      <p className="mb-6 text-center text-slate-500">Superadmin, sales, or marketing session</p>
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="block text-sm">
          Username
          <input
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <button className="w-full rounded-md bg-slate-900 py-2 font-semibold text-white" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
