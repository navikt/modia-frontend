import { requestOboToken } from "@navikt/oasis";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { env } from "hono/adapter";
import { HonoEnv } from ".";
import { secureLog } from "./logging";
import { fileConfig } from "./config";

type ProxyHandler = {
  url: string;
  scope: string;
};

const tlsOptions = import.meta.env.NODE_EXTRA_CA_CERTS
  ? {
      ca: Bun.file(import.meta.env.NODE_EXTRA_CA_CERTS),
    }
  : undefined;

// This function is here so we can inject a CA during tests
const getTlsOptions = () =>
  import.meta.env.NODE_ENV === "test" && import.meta.env.__TEST_EXTRA_CA_CERTS
    ? { ca: Bun.file(import.meta.env.__TEST_EXTRA_CA_CERTS) }
    : tlsOptions;

const proxyHandlers: NonNullable<typeof fileConfig>["proxy"] =
  fileConfig?.proxy ?? {};

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

  if (!token && env(c).SKIP_AUTH !== "true" && env(c).SKIP_AUTH !== true) {
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
  headers.delete("Host");

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

  secureLog.debug(
    `Outgoing proxy request
     IN: ${c.req.method} ${c.req.url}
     OUT: ${proxyRequest.method} ${proxyRequest.url}
     Headers: ${JSON.stringify(proxyRequest.headers)}
     `,
  );

  const res = await fetch(proxyRequest, {
    tls: getTlsOptions(),
    redirect: "manual",
  });

  secureLog.debug(
    `Proxy response from ${proxyRequest.url}: ${res.status}
     Headers: ${JSON.stringify(res.headers)}
    `,
  );

  return res;
});

export default proxyApp;
