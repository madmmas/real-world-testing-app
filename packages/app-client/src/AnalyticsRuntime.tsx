import { FLAG_OPENPANEL, type PublicUser } from "@rwa/shared";
import { useFlag, useUnleashContext } from "@unleash/proxy-client-react";
import { useEffect } from "react";
import {
  clearAnalyticsUser,
  configureOpenPanel,
  identifyUser,
  setOpenPanelEnabled,
  type OpenPanelConfig,
} from "./analytics";
import { featureAllowed } from "./featureAllowed";

export function AnalyticsRuntime({
  user,
  envEnabled,
  openPanel,
}: {
  user: PublicUser | null;
  envEnabled: string | undefined;
  openPanel: OpenPanelConfig;
}) {
  const flagOn = useFlag(FLAG_OPENPANEL);
  const enabled = featureAllowed(envEnabled, flagOn);
  const updateContext = useUnleashContext();

  useEffect(() => {
    configureOpenPanel(openPanel);
  }, [openPanel.apiUrl, openPanel.appName, openPanel.clientId]);

  useEffect(() => {
    void updateContext(
      user
        ? { userId: user.id, properties: { username: user.username, role: user.role } }
        : {}
    );
  }, [user, updateContext]);

  useEffect(() => {
    setOpenPanelEnabled(enabled);
    if (!enabled) {
      clearAnalyticsUser();
      return;
    }
    if (user) identifyUser(user);
    else clearAnalyticsUser();
  }, [enabled, user, openPanel.apiUrl, openPanel.appName, openPanel.clientId]);

  return null;
}
