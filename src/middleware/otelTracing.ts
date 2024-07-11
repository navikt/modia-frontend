import {
  trace,
  context,
  propagation,
  Exception,
  SpanKind,
} from "@opentelemetry/api";
import { createMiddleware } from "hono/factory";

const tracer = trace.getTracer(
  import.meta.env.OTEL_SERVICE_NAME ?? "modia-frontend",
);

export const tracingMiddleware = createMiddleware(async (c, next) => {
  const traceparent = c.req.header("traceparent");
  const tracestate = c.req.header("tracestate");
  const carrier = traceparent ? { traceparent, tracestate } : {};
  const extractedContext = propagation.extract(context.active(), carrier);

  await context.with(extractedContext, async () => {
    const span = tracer.startSpan(`${c.req.method} ${c.req.routePath}`, {
      kind: SpanKind.SERVER,
    });

    span.setAttribute("http.request.method", c.req.method);
    span.setAttribute("http.route", c.req.routePath);
    span.setAttribute("url.path", c.req.path.replace(/\d{11}/, "***********"));
    span.setAttribute("url.scheme", new URL(c.req.raw.url).protocol);
    span.setAttribute("user_agent.original", c.req.header("User-Agent") ?? "");
    span.setAttribute("is_root", true);
    if (traceparent) {
      const parts = traceparent.split("-");
      if (parts.length === 4) {
        span.setAttribute("trace.parent_id", parts[2]);
        span.setAttribute("trace.trace_id", parts[1]);
      }
    }

    await context.with(trace.setSpan(extractedContext, span), async () => {
      try {
        await next();
        span.setAttribute("http.response.status_code", c.res.status);
        span.setAttribute("status_code", c.res.status);
        c.res.headers.set("traceid", span.spanContext().traceId);
        span.end();
      } catch (err: unknown) {
        span.recordException(err as Exception);
        span.end();
        throw err;
      }
    });
  });
});
