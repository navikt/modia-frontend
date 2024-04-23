import { MiddlewareHandler } from "hono";
import config from "../config";
import { HTTPException } from "hono/http-exception";
import { getToken, validateToken } from "@navikt/oasis";

export const authMiddleware: MiddlewareHandler = async (c, next) => {
  if (config.SKIP_AUTH && import.meta.env.NODE_ENV !== "production") {
    return await next();
  }

  const tokenHeader = c.req.header("Authorization");

  if (!tokenHeader) {
    throw new HTTPException(401, { message: "Missing Authorization token" });
  }

  const token = getToken(tokenHeader);

  const valid = await validateToken(token);

  if (!valid.ok) {
    throw new HTTPException(403, { message: "Invalid authorization token" });
  }

  c.set("token", token);

  return await next();
};
