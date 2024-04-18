import { getToken, validateToken } from "@navikt/oasis";
import { Hono, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import proxyApp from "./proxy";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import config from "./config";
import path from "node:path";
import { logger } from "./logging";

type ContextVars = {
  token: string;
};
export type HonoEnv = { Variables: ContextVars };

const app = new Hono<HonoEnv>();
app.use(secureHeaders());

const authMiddleware: MiddlewareHandler = async (c, next) => {
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

app.use(authMiddleware);

app.route("/proxy", proxyApp);

if (!config.STATIC_FILES) {
  logger.error("Missing STATIC_FILES config.");
  process.exit(1);
}

app.get(
  "/static/*",
  serveStatic({
    root: config.STATIC_FILES,
    onNotFound: () => {
      throw new HTTPException(404);
    },
  }),
);
app.get("*", serveStatic({ root: config.STATIC_FILES }));
app.get(
  "/favicon.ico",
  serveStatic({
    path: path.join(config.STATIC_FILES, "favicon.ico"),
    onNotFound: () => {
      throw new HTTPException(404);
    },
  }),
);
app.get(
  "*",
  serveStatic({
    path: path.join(config.STATIC_FILES, "index.html"),
  }),
);

app.onError((err, c) => {
  logger.error(err.message, {
    stackStrace: err.stack,
  });
  return c.text("Noe gikk galt");
});

export default app;
