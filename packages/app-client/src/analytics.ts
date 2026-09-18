import { OpenPanel } from "@openpanel/web";
import type { PublicUser } from "@rwa/shared";

export type OpenPanelConfig = {
  apiUrl: string;
  clientId: string;
  appName: string;
};

let config: OpenPanelConfig | null = null;
let client: OpenPanel | null = null;
let sending = false;

export function configureOpenPanel(next: OpenPanelConfig) {
  config = next;
}

export function setOpenPanelEnabled(on: boolean) {
  sending = on && Boolean(config?.clientId);
  if (!sending || !config) return;
  if (!client) {
    client = new OpenPanel({
      apiUrl: config.apiUrl,
      clientId: config.clientId,
      trackScreenViews: true,
      trackOutgoingLinks: false,
      trackAttributes: false,
      filter: () => sending,
    });
    client.setGlobalProperties({ app: config.appName });
  }
}

export function track(name: string, properties?: Record<string, unknown>) {
  if (!sending || !client) return;
  client.track(name, properties);
}

export function identifyUser(user: PublicUser) {
  if (!sending || !client) return;
  client.identify({
    profileId: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    properties: { username: user.username, role: user.role },
  });
}

export function clearAnalyticsUser() {
  if (!client) return;
  client.clear();
}
