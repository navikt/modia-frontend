import { requestOboToken } from "@navikt/oasis";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { HonoEnv } from ".";
import { logger } from "./logging";

type ProxyHandler = {
  url: string;
  aud: string;
};

const proxyHandlers: { [path: string]: ProxyHandler } = {};

const getProxyHandler = (path: string): ProxyHandler | undefined => {
  const prefix = path.split("/");
  if (prefix.length === 0) {
    return undefined;
  }

  return proxyHandlers[prefix[0]];
};

const proxyApp = new Hono<HonoEnv>();

proxyApp.all("/:prefix/:path{.*}", async (c) => {
  const { prefix, path } = c.req.param();
  logger.info(path);
  const token = c.get("token");

  if (!token) {
    throw new HTTPException(403, { message: "Missing authentication token" });
  }

  const proxyHandler = getProxyHandler(prefix);
  if (!proxyHandler) {
    return c.notFound();
  }

  const { url, aud } = proxyHandler;

  const obo = await requestOboToken(token, aud);

  if (!obo.ok) {
    throw new HTTPException(403, {
      message: "Not authorized to access resource",
    });
  }

  const headers = c.req.raw.headers;
  headers.set("Authorization", `Bearer ${obo.token}`);

  const res = await fetch(new Request(url + path), { headers });

  return new Response(res.body, res);
});

export default proxyApp;
