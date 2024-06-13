import { describe, expect, it, mock, beforeAll, afterAll } from "bun:test";
import { getToken } from "@navikt/oasis";
import path from "node:path";

import app from "../src/index";
import { Server } from "bun";

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
        return new Response(
          JSON.stringify({
            path: req.url.replace("http://localhost:8888/", ""),
            obo: req.headers.get("Authorization"),
            server: req.url.includes("rest") ? "rest" : "other",
          }),
          {
            status: 200,
            headers: { proxy: "set-by-proxy" },
          },
        );
      },
    });
  });

  it("Should proxy ", async () => {
    const req = new Request("http://localhost/proxy/echo/test");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    const json: unknown = await res.json();
    expect(json).toHaveProperty("path", "test");

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

    process.env.__TEST_EXTRA_CA_CERTS = path.join(
      import.meta.dir,
      "rootCA.pem",
    );
  });

  it("Should work with custom CA certs", async () => {
    const req = new Request("https://localhost/proxy/https/test");
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
  });

  afterAll(() => {
    process.env.__TEST_EXTRA_CA_CERTS = undefined;
  });
});

afterAll(() => {
  server.stop();
});
