import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { CaptchaAuthError, useAuth, type CaptchaMode } from "../auth";
import AltchaField from "../components/AltchaField";

function altchaPayload(form: HTMLFormElement) {
  return String(new FormData(form).get("altcha") ?? "");
}

export default function SignIn() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("superadmin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [captchaMode, setCaptchaMode] = useState<CaptchaMode>("frictionless");
  const [captchaReset, setCaptchaReset] = useState(0);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    try {
      await login(username, password, altchaPayload(event.currentTarget));
    } catch (err) {
      if (err instanceof CaptchaAuthError) setCaptchaMode(err.captcha);
      setCaptchaReset((n) => n + 1);
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
        <AltchaField key={`${captchaMode}-${captchaReset}`} mode={captchaMode} />
        <button className="w-full rounded-md bg-slate-900 py-2 font-semibold text-white" type="submit">
          Sign in
        </button>
      </form>
    </div>
  );
}
