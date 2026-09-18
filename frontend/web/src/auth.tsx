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
import { ANALYTICS_EVENTS, type AuthTokens, type PublicUser } from "@rwa/shared";
import { clearAnalyticsUser, track } from "@rwa/app-client";

export type CaptchaMode = "frictionless" | "interactive";

type AuthState = {
  user: PublicUser | null;
  accessToken: string | null;
  ready: boolean;
  login: (username: string, password: string, altcha: string) => Promise<void>;
  signup: (payload: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    altcha: string;
  }) => Promise<void>;
  completeOAuth: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  gql: <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;
  apiFetch: (path: string, init?: RequestInit) => Promise<Response>;
  apiJson: <T>(path: string, init?: RequestInit) => Promise<T>;
  setUser: (user: PublicUser) => void;
};

const AuthContext = createContext<AuthState | null>(null);
const REFRESH_SKEW_MS = 30_000;
const REFRESH_STORAGE_KEY = "rwa.public.refresh";

async function readBody(res: Response) {
  try {
    return (await res.json()) as { error?: string; captcha?: CaptchaMode };
  } catch {
    return { error: res.statusText };
  }
}

export class CaptchaAuthError extends Error {
  captcha: CaptchaMode;
  constructor(message: string, captcha: CaptchaMode) {
    super(message);
    this.name = "CaptchaAuthError";
    this.captcha = captcha;
  }
}

function throwAuthError(body: { error?: string; captcha?: CaptchaMode }) {
  if (body.captcha) throw new CaptchaAuthError(body.error ?? "Captcha required", body.captcha);
  throw new Error(body.error ?? "Request failed");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const accessTokenRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<string | null>(null);
  const expiresAtRef = useRef(0);
  const refreshInFlight = useRef<Promise<boolean> | null>(null);

  const clearTokens = () => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    expiresAtRef.current = 0;
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
    setAccessToken(null);
  };

  const applyTokens = (tokens: AuthTokens) => {
    accessTokenRef.current = tokens.accessToken;
    refreshTokenRef.current = tokens.refreshToken;
    expiresAtRef.current = Date.parse(tokens.expiresAt);
    sessionStorage.setItem(REFRESH_STORAGE_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
  };

  const loadMe = async () => {
    const res = await fetch("/me", {
      headers: accessTokenRef.current ? { Authorization: `Bearer ${accessTokenRef.current}` } : {},
    });
    if (!res.ok) throw new Error("Unauthorized");
    const data = (await res.json()) as { user: PublicUser };
    setUser(data.user);
  };

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = (async () => {
      const currentRefresh = refreshTokenRef.current ?? sessionStorage.getItem(REFRESH_STORAGE_KEY);
      if (!currentRefresh) {
        clearTokens();
        return false;
      }
      const res = await fetch("/auth/jwt/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: currentRefresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      applyTokens((await res.json()) as AuthTokens);
      return true;
    })();

    refreshInFlight.current = run;
    try {
      return await run;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);

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

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (expiresAtRef.current && Date.now() >= expiresAtRef.current - REFRESH_SKEW_MS) {
        await refreshAccessToken();
      }
      const send = () => {
        const headers = new Headers(init.headers);
        if (accessTokenRef.current) headers.set("Authorization", `Bearer ${accessTokenRef.current}`);
        if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
        return fetch(path, { ...init, headers });
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

  const apiJson = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await apiFetch(path, init);
      const body = (await res.json().catch(() => ({}))) as T & { error?: string };
      if (!res.ok) throw new Error(body.error ?? "Request failed");
      return body;
    },
    [apiFetch]
  );

  const bootstrap = useCallback(async () => {
    try {
      const stored = sessionStorage.getItem(REFRESH_STORAGE_KEY);
      if (!stored) return;
      refreshTokenRef.current = stored;
      const refreshed = await refreshAccessToken();
      if (refreshed) await loadMe();
    } catch {
      setUser(null);
      clearTokens();
    } finally {
      setReady(true);
    }
  }, [refreshAccessToken]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = async (username: string, password: string, altcha: string) => {
    const res = await fetch("/auth/jwt/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password, altcha }),
    });
    if (!res.ok) throwAuthError(await readBody(res));
    const data = (await res.json()) as AuthTokens & { user: PublicUser };
    applyTokens(data);
    setUser(data.user);
    track(ANALYTICS_EVENTS.login, { method: "password" });
  };

  const signup = async (payload: {
    username: string;
    password: string;
    firstName: string;
    lastName: string;
    altcha: string;
  }) => {
    const res = await fetch("/auth/jwt/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throwAuthError(await readBody(res));
    const data = (await res.json()) as AuthTokens & { user: PublicUser };
    applyTokens(data);
    setUser(data.user);
    track(ANALYTICS_EVENTS.signupCompleted);
  };

  const completeOAuth = useCallback(async (tokens: AuthTokens) => {
    applyTokens(tokens);
    await loadMe();
    track(ANALYTICS_EVENTS.oauthGoogle);
  }, []);

  const logout = async () => {
    await fetch("/auth/jwt/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshTokenRef.current }),
    });
    setUser(null);
    clearTokens();
    clearAnalyticsUser();
  };

  const value = useMemo(
    () => ({ user, accessToken, ready, login, signup, completeOAuth, logout, gql, apiFetch, apiJson, setUser }),
    [user, accessToken, ready, completeOAuth, gql, apiFetch, apiJson]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
