/**
 * Unleash is the default gate. Env can allow or deny the same feature:
 *   true / 1 / yes / on  → on even if the Unleash flag is off
 *   false / 0 / no / off → off even if the Unleash flag is on
 *   unset / empty        → Unleash flag only
 */
export function featureAllowed(envValue: string | undefined, flagOn: boolean): boolean {
  const value = envValue?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes" || value === "on") return true;
  if (value === "false" || value === "0" || value === "no" || value === "off") return false;
  return flagOn;
}
