import { useEffect, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import type { AuthTokens } from "@rwa/shared";
import { useAuth } from "../auth";

export default function OAuthCallback() {
  const { user, completeOAuth } = useAuth();
  const [error, setError] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const expiresAt = params.get("expires_at");
    const expiresIn = Number(params.get("expires_in") ?? 0);
    if (!accessToken || !refreshToken || !expiresAt) {
      setError("Google sign-in did not return tokens");
      return;
    }
    const tokens: AuthTokens = {
      accessToken,
      refreshToken,
      expiresAt,
      expiresIn,
      tokenType: "Bearer",
    };
    void completeOAuth(tokens).catch((err) => {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
    });
  }, [completeOAuth]);

  if (user) return <Navigate to="/" replace />;
  if (error) {
    return (
      <p className="mx-auto mt-16 max-w-md rounded-md bg-red-50 p-4 text-sm text-red-700">{error}</p>
    );
  }
  return <p className="p-10 text-center text-slate-500">Finishing Google sign-in…</p>;
}
