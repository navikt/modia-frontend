import { requestOboToken } from "@navikt/oasis";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "hono/adapter";
import { HonoEnv } from ".";
import { logger, secureLog } from "./logging";
import config from "./config";
import fs from "node:fs/promises";

type ProxyHandler = {
  url: string;
  scope: string;
};

type ProxyConfig = {
  proxy: {
    prefix: {
      url: string;
      scope: string;
    };
  };
};

const loadProxyConfig = async (): Promise<{
  [prefix: string]: ProxyHandler;
}> => {
  try {
    if (config.PROXY_CONFIG) {
      logger.info("Reading proxy configuration from PROXY_CONFIG environment");
      const conf = (await JSON.parse(config.PROXY_CONFIG)) as ProxyConfig;
      return conf.proxy;
    } else {
      const confFile = config.PROXY_CONFIG_PATH;
      if (await fs.stat(confFile)) {
        logger.info(`Reading proxy configuration from file (${confFile})`);
        const data = await fs.readFile(confFile, "utf8");
        const conf = (await JSON.parse(data)) as ProxyConfig;
        return conf.proxy;
      } else {
        logger.info(
          "No proxy configuration defined. No proxies will be configured",
        );
        return {};
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Error parsing proxy config: ${e.message}`, {
        stackTrace: e.stack,
      });
    } else {
      logger.error("Error parsing proxy config");
    }

    return {};
  }
};

const proxyHandlers = await loadProxyConfig();

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
  const token = c.get("token");

  if (!token && !env(c).SKIP_AUTH) {
    throw new HTTPException(403, { message: "Missing authentication token" });
  }

  const proxyHandler = getProxyHandler(prefix);
  if (!proxyHandler) {
    return c.notFound();
  }

  const { url, scope } = proxyHandler;

  const obo = await requestOboToken(token, scope);

  if (!obo.ok) {
    secureLog.warn(`OBO-token error: ${obo.error.name} ${obo.error.message}`, {
      stackTrace: obo.error.stack,
    });
    throw new HTTPException(403, {
      message: "Not authorized to access resource",
    });
  }

  const headers = c.req.raw.headers;
  headers.set("Authorization", `Bearer ${obo.token}`);
  headers.delete("Cookie");

  const proxyPath =
    Object.keys(c.req.query()).length > 0
      ? path + "?" + new URLSearchParams(c.req.query()).toString()
      : path;

  const proxyUrl = `${url}/${proxyPath}`;
  const proxyRequest = new Request(proxyUrl, {
    headers,
    method: c.req.method,
    body: c.req.raw.body,
  });

  secureLog.info(
    `Outgoing proxy request\nOriginalUrl: ${c.req.url}\nProxyUrl: ${proxyRequest.url}`,
  );

  const res = await fetch(proxyRequest);

  return new Response(res.body, res);
});

export default proxyApp;
