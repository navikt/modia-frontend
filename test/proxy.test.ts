import { afterAll, beforeAll, describe, expect, it, mock } from "bun:test";
import path from "node:path";
import { getToken } from "@navikt/oasis";

import type { Server } from "bun";
import app from "../src/index";

await mock.module("@navikt/oasis", () => {
  return {
    validateAzureToken: () => ({ ok: true }),
    getToken,
    requestOboToken: () => ({ ok: true, token: "obo-token" }),
  };
});

let server: Server;

describe("Proxy", () => {
  beforeAll(() => {
    server = Bun.serve({
      port: 8888,
      fetch(req) {
        const url = new URL(req.url);
        const status = url.searchParams.get("status");
        const noBody = url.searchParams.get("nobody");
        const statusCode = status ? Number.parseInt(status) : 200;

        const headers: HeadersInit = {
          proxy: "set-by-proxy",
        };

        if (statusCode === 301 || statusCode === 302) {
          headers.location = "http://redirected.local";
        }

        return new Response(
          noBody
            ? undefined
            : JSON.stringify({
                path: url.pathname,
                obo: req.headers.get("Authorization"),
                server: req.url.includes("rest") ? "rest" : "other",
              }),
          {
            status: statusCode,
            headers,
          },
        );
      },
    });
  });

  it("Should proxy ", async () => {
    const req = new Request("http://localhost/proxy/echo/test", {
      headers: { Authorization: "test" },
    });
    const res = await app.fetch(req, { SKIP_AUTH: "false" });

    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(json).toHaveProperty("path", "/test");

    expect(res.headers.get("proxy")).toEqual("set-by-proxy");
    expect(json).toHaveProperty("obo", "Bearer obo-token");
  });

  it("should resolve proxies correctly", async () => {
    const req = new Request("http://localhost/proxy/rest/test");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(json).toHaveProperty("server", "rest");
  });

  it("should proxy response status properly", async () => {
    const req = new Request("http://localhost/proxy/echo/test/?status=401");
    const res = await app.fetch(req);

    expect(res.status).toBe(401);
  });

  it("should not follow redirects", async () => {
    const req = new Request("http://localhost/proxy/echo/test/?status=302");
    const res = await app.fetch(req);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("http://redirected.local");
  });

  it("Should proxy correctly for POST requests", async () => {
    const res2 = await app.fetch(
      new Request("http://localhost/proxy/echo/test/?status=403&nobody=true", {
        method: "POST",
        body: JSON.stringify({ key: "this is a test" }),
      }),
    );

    expect(res2.status).toBe(403);
    expect(res2.headers.get("content-length")).toBe("0");
  });

  it("should return 404 for unknown path", async () => {
    const req = new Request("http://localhost/proxy/unknown/test/testing");
    const res = await app.fetch(req);

    expect(res.status).toBe(404);
  });
});

describe("Proxy https with NODE_EXTRA_CA_CERTS", () => {
  beforeAll(() => {
    Bun.serve({
      port: 9999,
      cert: Bun.file(path.join(import.meta.dir, "localhost.pem")),
      key: Bun.file(path.join(import.meta.dir, "localhost-key.pem")),
      fetch() {
        return new Response("OK");
      },
    });
  });

  it("Should work with custom CA certs", async () => {
    const req = new Request("https://localhost/proxy/https/test");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
  });
});

afterAll(() => {
  server.stop();
});
