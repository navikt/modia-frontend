import { getToken, validateToken } from "@navikt/oasis";
import { Hono, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import proxyApp from "./proxy";
import { serveStatic } from "hono/bun";

const STATIC_FILE_PATH = "./static";

type ContextVars = {
  token: string;
};
export type HonoEnv = { Variables: ContextVars };

const app = new Hono<HonoEnv>();

const authMiddleware: MiddlewareHandler = async (c, next) => {
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

app.use(authMiddleware);

app.route("/proxy", proxyApp);

app.get("*", serveStatic({ path: STATIC_FILE_PATH }));

export default app;
