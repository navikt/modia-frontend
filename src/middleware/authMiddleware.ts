import { MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import { getToken, validateAzureToken } from "@navikt/oasis";
import { env } from "hono/adapter";
import { HonoEnv } from "..";
import { secureLog } from "../logging";

export const authMiddleware: MiddlewareHandler<HonoEnv> = async (c, next) => {
  if (
    (env(c).SKIP_AUTH === "true" || env(c).SKIP_AUTH === true) &&
    import.meta.env.NODE_ENV !== "production"
  ) {
    return await next();
  }

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
  return await next();
};
