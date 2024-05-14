import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import proxyApp from "./proxy";
import { serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import config, { fileConfig } from "./config";
import path from "node:path";
import { logger } from "./logging";
import { htmlRewriterMiddleware, authMiddleware } from "./middleware";

type ContextVars = {
  token: string;
  userId: string;
};
export type HonoEnv = {
  Variables: ContextVars;
  Bindings: { SKIP_AUTH?: boolean };
};

const baseApp = new Hono<HonoEnv>();

const internalApp = baseApp.basePath("/internal");

internalApp.get("/liveness", (c) => {
  return c.text("OK", 200);
});

internalApp.get("/readiness", (c) => {
  return c.text("OK", 200);
});

const app = baseApp.basePath(config.BASE_PATH);

if (!config.STATIC_FILES) {
  logger.error("Missing STATIC_FILES config.");
  process.exit(1);
}

app.use(
  secureHeaders({ contentSecurityPolicy: fileConfig?.contentSecurityPolicy }),
);

app.use(authMiddleware);

app.route("/proxy", proxyApp);

app.use("*", htmlRewriterMiddleware);

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
    rewriteRequestPath: (path) =>
      path.replace(new RegExp(`/${config.BASE_PATH.replaceAll("/", "")}`), ""),
    root: config.STATIC_FILES,
  }),
);

// Fallback
app.get("*", (c) => {
  if (c.req.header("Accept")?.match(/text\/html/) && config.STATIC_FILES) {
    c.res = new Response(
      Bun.file(path.join(config.STATIC_FILES, "index.html")),
    );
  }

  return c.notFound();
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  console.log(err);

  logger.error(err.message, {
    stackStrace: err.stack,
    error: err,
  });
  return c.text("Noe gikk galt. (Internal server error)", 500);
});

export default app;
