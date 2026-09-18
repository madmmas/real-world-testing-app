import { initialize, type Unleash } from "unleash-client";
import { FLAG_ELASTICSEARCH_SEARCH, featureAllowed } from "@rwa/shared";

let unleash: Unleash | null = null;

export function startFlags() {
  const url = process.env.UNLEASH_URL?.trim();
  const token = process.env.UNLEASH_API_TOKEN?.trim();
  if (!url || !token) return;
  unleash = initialize({
    url,
    appName: "books-service",
    customHeaders: { Authorization: token },
  });
}

export function elasticsearchSearchEnabled() {
  const flagOn = unleash?.isEnabled(FLAG_ELASTICSEARCH_SEARCH) ?? false;
  return featureAllowed(process.env.ELASTICSEARCH_SEARCH_ENABLED, flagOn);
}
