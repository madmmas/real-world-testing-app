import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/auth/jwt/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(body.error ?? "Reset failed");
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="text-xl font-semibold">Reset password</h1>
      {done ? (
        <p className="mt-4 text-sm text-slate-600">
          Password updated.{" "}
          <Link className="text-blue-600 underline" to="/signin">
            Sign in
          </Link>
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {!token ? <p className="text-sm text-red-600">Missing token in the link.</p> : null}
          <label className="block text-sm">
            New password
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              type="password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button className="w-full rounded-md bg-blue-600 py-2 text-white" type="submit" disabled={!token}>
            Save password
          </button>
        </form>
      )}
    </div>
  );
}
