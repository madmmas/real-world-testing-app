import { FormEvent, useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { CaptchaAuthError, useAuth, type CaptchaMode } from "../auth";
import AltchaField from "../components/AltchaField";
import { safeNextPath } from "../next";

function altchaPayload(form: HTMLFormElement) {
  return String(new FormData(form).get("altcha") ?? "");
}

export default function SignIn() {
  const { user, login } = useAuth();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ?? "");
  const [captchaMode, setCaptchaMode] = useState<CaptchaMode>("frictionless");
  const [captchaReset, setCaptchaReset] = useState(0);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    void fetch("/auth/oauth/providers")
      .then((res) => res.json())
      .then((body: { google?: boolean }) => setGoogleEnabled(Boolean(body.google)))
      .catch(() => setGoogleEnabled(false));
  }, []);

  if (user) return <Navigate to={safeNextPath(params.get("next"))} replace />;

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
    <div className="mx-auto mt-16 max-w-md rounded-2xl bg-white p-8 shadow">
      <h1 className="mb-1 text-center text-2xl font-bold text-blue-600">Books Library</h1>
      <p className="mb-6 text-center text-slate-500">Sign in with JWT or Google</p>
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
        <button className="w-full rounded-md bg-blue-600 py-2 font-semibold text-white hover:bg-blue-500" type="submit">
          Sign in
        </button>
      </form>
      <div className="my-4 flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      {googleEnabled ? (
        <a
          className="block w-full rounded-md border border-slate-300 py-2 text-center font-semibold hover:bg-slate-50"
          href="/auth/oauth/google"
        >
          Continue with Google
        </a>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Google sign-in is off until GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set.
        </p>
      )}
      <p className="mt-4 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link className="text-blue-600 underline" to={params.get("next") ? `/signup?next=${encodeURIComponent(safeNextPath(params.get("next")))}` : "/signup"}>
          Sign up
        </Link>
        {" · "}
        <Link className="text-blue-600 underline" to="/forgot">
          Forgot password
        </Link>
      </p>
    </div>
  );
}
