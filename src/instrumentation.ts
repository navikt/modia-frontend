import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import * as api from "@opentelemetry/api";

const sdk = new NodeSDK({
  instrumentations: [
    getNodeAutoInstrumentations({
      "@opentelemetry/instrumentation-fs": { enabled: false },
    }),
  ],
});

sdk.start();

const globalFetch = global.fetch;

export async function fetcher(
  input: URL | RequestInfo,
  init?: RequestInit,
): Promise<Response> {
  const tracer = api.trace.getTracer(
    `${import.meta.env.OTEL_SERVICE_NAME}:httpclient`,
  );
  let url: URL;
  if (typeof input === "string") {
    url = new URL(input);
  } else if (input instanceof URL) {
    url = input;
  } else {
    url = new URL(input.url);
  }
  const method = init?.method ?? "GET";

  return await tracer.startActiveSpan(`HTTP ${method}`, async (span) => {
    const request = new Request(url, init);
    const propagationHeaders: Record<string, string> = {};
    api.propagation.inject(api.context.active(), propagationHeaders);

    Object.entries(propagationHeaders).forEach(([header, value]) => {
      request.headers.set(header, value);
    });
    span.setAttribute("component", "fetch");
    span.setAttribute(
      "server.address",
      request.headers.get("Host") ?? "unkown",
    );
    span.setAttribute("http.url", url.toString());
    span.setAttribute("http.request.method", method);
    span.setAttribute("http.scheme", url.protocol);

    const response = await globalFetch(request);

    span.setAttribute("http.response.status_code", response.status);
    span.end();

    return response;
  });
}

global.fetch = fetcher;
