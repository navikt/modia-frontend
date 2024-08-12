import * as api from "@opentelemetry/api";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";

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
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const tracer = api.trace.getTracer(
    `${import.meta.env.OTEL_SERVICE_NAME}:httpclient`,
  );

  let request: Request;
  if (input instanceof Request) {
    request = input;
  } else {
    request = new Request(input);
  }
  const method = request.method;
  const url = new URL(request.url);

  return await tracer.startActiveSpan(
    `${method}`,
    { kind: api.SpanKind.CLIENT },
    async (span) => {
      const propagationHeaders: Record<string, string> = {};
      api.propagation.inject(api.context.active(), propagationHeaders);

      for (const [header, value] of Object.entries(propagationHeaders)) {
        request.headers.set(header, value);
      }

      span.setAttribute("server.address", url.host);
      span.setAttribute("server.port", url.port);
      span.setAttribute("url.full", url.toString());
      span.setAttribute("http.request.method", method);
      span.setAttribute("url.scheme", url.protocol);

      const response = await globalFetch(request, init);

      span.setAttribute("http.response.status_code", response.status);
      span.end();

      return response;
    },
  );
}

global.fetch = fetcher;
