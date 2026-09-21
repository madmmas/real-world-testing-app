import { useEffect, useState } from "react";
import { featureAllowed } from "@rwa/shared";

export function useAltchaEnabled(envValue?: string) {
  const [server, setServer] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/auth/captcha/status")
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((body: { enabled?: boolean }) => {
        if (!cancelled) setServer(body.enabled !== false);
      })
      .catch(() => {
        if (!cancelled) setServer(featureAllowed(envValue, true));
      });
    return () => {
      cancelled = true;
    };
  }, [envValue]);

  if (server !== null) return server;
  return featureAllowed(envValue, true);
}
