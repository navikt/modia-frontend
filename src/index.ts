import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import proxyApp from "./proxy";
import { secureHeaders } from "hono/secure-headers";
import config from "./config";
import { logger } from "./logging";
import { authMiddleware } from "./middleware";
import { HttpBindings } from "@hono/node-server/.";
import path from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { RESPONSE_ALREADY_SENT } from "@hono/node-server/utils/response";
import fs from "node:fs";

type ContextVars = {
  token: string;
};
export type HonoEnv = {
  Variables: ContextVars;
  Bindings: HttpBindings & { SKIP_AUTH?: boolean };
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

app.use(secureHeaders());

app.use(authMiddleware);

app.route("/proxy", proxyApp);

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
    onNotFound: (path) => {
      logger.info(`not found: ${path}`);
    },
  }),
);

// Fallback
app.get("*", async (c) => {
  if (c.req.header("Accept")?.match(/text\/html/) && config.STATIC_FILES) {
    const docPath = path.join(config.STATIC_FILES, "index.html");
    if (!fs.statSync(docPath)) {
      return c.notFound();
    }

    const { outgoing } = c.env;
    outgoing.writeHead(200, { "Content-Type": "text/html" });

    fs.createReadStream(docPath).pipe(outgoing);

    return RESPONSE_ALREADY_SENT;
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

serve(app);
