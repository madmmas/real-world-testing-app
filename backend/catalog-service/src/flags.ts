import { FLAG_ELASTICSEARCH_SEARCH, featureAllowed } from "@rwa/shared";
import { isUnleashEnabled, startUnleash } from "@rwa/service-kit";

export function startFlags() {
  void startUnleash("catalog-service");
}

export function elasticsearchSearchEnabled() {
  return featureAllowed(process.env.ELASTICSEARCH_SEARCH_ENABLED, isUnleashEnabled(FLAG_ELASTICSEARCH_SEARCH));
}
