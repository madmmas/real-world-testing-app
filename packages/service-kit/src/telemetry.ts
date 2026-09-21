import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { initialize, type Unleash } from "unleash-client";
import { FLAG_OPENTELEMETRY, featureAllowed } from "@rwa/shared";

loadEnv({ path: resolve(process.cwd(), "../../.env") });
loadEnv();

let unleash: Unleash | null = null;
let starting: Promise<void> | null = null;
let sdkStarted = false;

function envOtel() {
  return process.env.OTEL_ENABLED ?? process.env.OPENTELEMETRY_ENABLED;
}

export function isUnleashEnabled(name: string, fallback = false) {
  if (!unleash) return fallback;
  return unleash.isEnabled(name, undefined, fallback);
}

export function otelEnabled() {
  return featureAllowed(envOtel(), isUnleashEnabled(FLAG_OPENTELEMETRY));
}

export function startUnleash(appName: string) {
  if (starting) return starting;
  if (unleash) return Promise.resolve();
  const url = process.env.UNLEASH_URL?.trim();
  const token = process.env.UNLEASH_API_TOKEN?.trim();
  if (!url || !token) return Promise.resolve();

  starting = new Promise((resolve) => {
    unleash = initialize({
      url,
      appName,
      customHeaders: { Authorization: token },
    });
    const done = () => {
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 4000);
    unleash.once("synchronized", done);
    unleash.once("error", done);
  });
  return starting;
}

export async function startOpenTelemetry(serviceName: string) {
  if (sdkStarted || !otelEnabled()) return;
  const endpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318").replace(
    /\/$/,
    ""
  );

  const [{ NodeSDK }, { OTLPTraceExporter }, { OTLPMetricExporter }, { PeriodicExportingMetricReader }, { Resource }, { getNodeAutoInstrumentations }] =
    await Promise.all([
      import("@opentelemetry/sdk-node"),
      import("@opentelemetry/exporter-trace-otlp-http"),
      import("@opentelemetry/exporter-metrics-otlp-http"),
      import("@opentelemetry/sdk-metrics"),
      import("@opentelemetry/resources"),
      import("@opentelemetry/auto-instrumentations-node"),
    ]);

  const sdk = new NodeSDK({
    resource: new Resource({ "service.name": serviceName }),
    traceExporter: new OTLPTraceExporter({ url: `${endpoint}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${endpoint}/v1/metrics` }),
      exportIntervalMillis: 10_000,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? "";
            return url === "/health" || url.startsWith("/health?");
          },
        },
      }),
    ],
  });
  sdk.start();
  sdkStarted = true;
  console.log(
    JSON.stringify({
      "@timestamp": new Date().toISOString(),
      service: serviceName,
      msg: "opentelemetry_started",
      endpoint,
    })
  );
}

export async function bootstrapTelemetry() {
  const raw = process.env.OTEL_SERVICE_NAME?.trim() || process.env.npm_package_name || "rwa";
  const serviceName = raw.replace(/^@rwa\//, "");
  await startUnleash(serviceName);
  await startOpenTelemetry(serviceName);
}
