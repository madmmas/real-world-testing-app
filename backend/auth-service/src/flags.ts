import { FLAG_ALTCHA, featureAllowed } from "@rwa/shared";
import { isUnleashEnabled } from "@rwa/service-kit";

export function altchaEnabled() {
  return featureAllowed(process.env.ALTCHA_ENABLED, isUnleashEnabled(FLAG_ALTCHA, true));
}
