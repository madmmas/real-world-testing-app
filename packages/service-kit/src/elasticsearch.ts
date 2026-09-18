import { Client } from "@elastic/elasticsearch";

let client: Client | null | undefined;

export function elasticsearchUrl() {
  return process.env.ELASTICSEARCH_URL?.trim() ?? "";
}

export function getElasticsearch(): Client | null {
  const url = elasticsearchUrl();
  if (!url) return null;
  if (client === undefined) {
    client = new Client({ node: url, requestTimeout: 2_000, pingTimeout: 1_000, maxRetries: 1 });
  }
  return client;
}
