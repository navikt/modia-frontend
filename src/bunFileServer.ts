import path from "node:path";
import { serveStatic } from "hono/bun";
import { HonoEnv } from ".";
import { Hono } from "hono";
import config from "./config";
import { HTTPException } from "hono/http-exception";

const setupBunFileServer = (app: Hono<HonoEnv>) => {
  if (!config.STATIC_FILES) {
    return;
  }

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
        path.replace(
          new RegExp(`/${config.BASE_PATH.replaceAll("/", "")}`),
          "",
        ),
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
};
export default setupBunFileServer;
