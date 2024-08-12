import { getToken, validateAzureToken } from "@navikt/oasis";
import { trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import { env } from "hono/adapter";
import { HTTPException } from "hono/http-exception";
import type { HonoEnv } from "..";
import { secureLog } from "../logging";

const tracer = trace.getTracer("modia-frontend:middleware");

export const authMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (
    (env(c).SKIP_AUTH === "true" || env(c).SKIP_AUTH === true) &&
    import.meta.env.NODE_ENV !== "production"
  ) {
    return await next();
  }
  await tracer.startActiveSpan("authmiddleware", async (span) => {
    const tokenHeader = c.req.header("Authorization");

    if (!tokenHeader) {
      throw new HTTPException(401, { message: "Missing Authorization token" });
    }

    const token = getToken(tokenHeader);

    const valid = await validateAzureToken(token);

    if (!valid.ok) {
      secureLog.warn(
        `Token validation error: ${valid.error.name} - ${valid.error.message}`,
        {
          stackTrace: valid.error.stack,
        },
      );
      throw new HTTPException(403, { message: "Invalid authorization token." });
    }

    c.set("token", token);

    if (valid.payload.NAVident) {
      c.set("userId", valid.payload.NAVident);
    }
    span.end();
  });
  return await next();
};
