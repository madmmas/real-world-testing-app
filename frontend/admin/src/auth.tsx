import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AuthTokens, PublicUser } from "@rwa/shared";

type AuthState = {
  user: PublicUser | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  gql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
};

const AuthContext = createContext<AuthState | null>(null);
const REFRESH_SKEW_MS = 30_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [ready, setReady] = useState(false);
  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef(0);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const applyTokens = (tokens: AuthTokens) => {
    accessTokenRef.current = tokens.accessToken;
    refreshTokenRef.current = tokens.refreshToken;
    expiresAtRef.current = Date.parse(tokens.expiresAt);
  };

  const clearTokens = () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    expiresAtRef.current = 0;
  };

  const mintJwt = async () => {
    const res = await fetch("/auth/jwt/from-session", { method: "POST", credentials: "include" });
    if (!res.ok) throw new Error("Unauthorized");
    applyTokens((await res.json()) as AuthTokens);
  };

  const refreshAccessToken = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    const run = (async () => {
      const current = refreshTokenRef.current;
      if (current) {
        const res = await fetch("/auth/jwt/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: current }),
        });
        if (res.ok) {
          applyTokens((await res.json()) as AuthTokens);
          return true;
        }
      }
      try {
        await mintJwt();
        return true;
      } catch {
        clearTokens();
        setUser(null);
        return false;
      }
    })();
    refreshInFlight.current = run;
    try {
      return await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (expiresAtRef.current && Date.now() >= expiresAtRef.current - REFRESH_SKEW_MS) {
        await refreshAccessToken();
      }
      const send = () => {
        const headers = new Headers(init.headers);
        if (accessTokenRef.current) headers.set("Authorization", `Bearer ${accessTokenRef.current}`);
        if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        return fetch(path, { ...init, headers, credentials: "include" });
      };
      let res = await send();
      if (res.status === 401) {
        const refreshed = await refreshAccessToken();
        if (refreshed) res = await send();
      }
      return res;
    },
    [refreshAccessToken]
  );

  const gql = useCallback(
    async <T,>(query: string, variables?: Record<string, unknown>): Promise<T> => {
      if (expiresAtRef.current && Date.now() >= expiresAtRef.current - REFRESH_SKEW_MS) {
        await refreshAccessToken();
      }
      const send = () => {
        const headers = new Headers({ "Content-Type": "application/json" });
        if (accessTokenRef.current) headers.set("Authorization", `Bearer ${accessTokenRef.current}`);
        return fetch("/graphql", {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({ query, variables }),
        });
      };
      let res = await send();
      let body = (await res.json()) as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
      const unauth = body.errors?.some((err) => err.extensions?.code === "UNAUTHENTICATED");
      if (unauth) {
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          res = await send();
          body = (await res.json()) as typeof body;
        }
      }
      if (body.errors?.length) throw new Error(body.errors[0]!.message);
      if (!body.data) throw new Error("GraphQL returned no data");
      return body.data;
    },
    [refreshAccessToken]
  );

  const bootstrap = useCallback(async () => {
    try {
      const me = await fetch("/auth/session/me", { credentials: "include" });
      if (!me.ok) {
        setUser(null);
        clearTokens();
        return;
      }
      const data = (await me.json()) as { user: PublicUser };
      setUser(data.user);
      await mintJwt();
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = async (username: string, password: string) => {
    const res = await fetch("/auth/session/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(body.error ?? "Login failed");
    }
    const data = (await res.json()) as { user: PublicUser };
    setUser(data.user);
    await mintJwt();
  };

  const logout = async () => {
    await fetch("/auth/jwt/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
    });
    await fetch("/auth/session/logout", { method: "POST", credentials: "include" });
    setUser(null);
    clearTokens();
  };

  const value = useMemo(
    () => ({ user, ready, login, logout, apiFetch, gql }),
    [user, ready, apiFetch, gql]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
