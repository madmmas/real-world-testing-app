import { FormEvent, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { CaptchaAuthError, useAuth } from "../auth";
import AltchaField from "../components/AltchaField";
import { safeNextPath } from "../next";

function altchaPayload(form: HTMLFormElement) {
  return String(new FormData(form).get("altcha") ?? "");
}

export default function SignUp() {
  const { user, signup } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ firstName: "", lastName: "", username: "", password: "" });
  const [error, setError] = useState("");

  if (user) return <Navigate to={safeNextPath(params.get("next"))} replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await signup({ ...form, altcha: altchaPayload(event.currentTarget) });
    } catch (err) {
      if (!(err instanceof CaptchaAuthError)) {
        setError(err instanceof Error ? err.message : "Sign up failed");
        return;
      }
      setError(err.message);
    }
  }

  return (
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="mb-6 text-center text-2xl font-bold">Create an account</h1>
      {error && <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <form className="space-y-3" onSubmit={(e) => void onSubmit(e)}>
        {(["firstName", "lastName", "username", "password"] as const).map((field) => (
          <label key={field} className="block text-sm capitalize">
            {field.replace(/([A-Z])/g, " $1")}
            <input
              type={field === "password" ? "password" : "text"}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
              value={form[field]}
              onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            />
          </label>
        ))}
        <AltchaField mode="frictionless" />
        <button className="w-full rounded-md bg-blue-600 py-2 font-semibold text-white" type="submit">
          Sign up
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        Already have an account?{" "}
        <Link className="text-blue-600 underline" to="/signin">
          Sign in
        </Link>
      </p>
    </div>
  );
}
