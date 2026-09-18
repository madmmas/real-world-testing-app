import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/auth/jwt/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? "Could not send reset mail");
      return;
    }
    setDone(true);
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="text-xl font-semibold">Forgot password</h1>
      {done ? (
        <p className="mt-4 text-sm text-slate-600">
          If that email is on a buyer or shop account, check Mailpit at{" "}
          <a className="text-blue-600 underline" href="http://localhost:8025">
            http://localhost:8025
          </a>
          .
        </p>
      ) : (
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <label className="block text-sm">
            Email
            <input
              className="mt-1 w-full rounded-md border px-3 py-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <button className="w-full rounded-md bg-blue-600 py-2 text-white" type="submit">
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-4 text-center text-sm">
        <Link className="text-blue-600 underline" to="/signin">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
