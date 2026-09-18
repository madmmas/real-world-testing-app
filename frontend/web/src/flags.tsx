import { useMemo, type ReactNode } from "react";
import { AnalyticsRuntime, FlagsRoot } from "@rwa/app-client";
import { useAuth } from "./auth";

export function WebFlags({ children }: { children: ReactNode }) {
  const config = useMemo(
    () => ({
      url: import.meta.env.VITE_UNLEASH_URL ?? "http://localhost:4242/api/frontend",
      clientKey:
        import.meta.env.VITE_UNLEASH_CLIENT_KEY ??
        "default:development.unleash-insecure-frontend-api-token",
      refreshInterval: 15,
      appName: "web",
    }),
    []
  );
  return <FlagsRoot config={config}>{children}</FlagsRoot>;
}

export function WebAnalytics() {
  const { user } = useAuth();
  const openPanel = useMemo(
    () => ({
      apiUrl: import.meta.env.VITE_OPENPANEL_API_URL ?? "http://localhost:3350/api",
      clientId: import.meta.env.VITE_OPENPANEL_CLIENT_ID ?? "",
      appName: "web",
    }),
    []
  );
  return (
    <AnalyticsRuntime
      user={user}
      envEnabled={import.meta.env.VITE_OPENPANEL_ENABLED}
      openPanel={openPanel}
    />
  );
}
