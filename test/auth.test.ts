import { describe, expect, it, mock, afterAll } from "bun:test";
import { getToken } from "@navikt/oasis";

import app from "../src/index";

process.env.SKIP_AUTH = false;
const invalidToken = "o97978sdfsdf908sd";
const validToken = "thisisavalidtoken";

await mock.module("@navikt/oasis", () => {
  return {
    validateAzureToken: (token: string) => {
      if (token === validToken)
        return { ok: true, payload: { NAVident: "A123456" } };
      return { ok: false, error: { name: "mock error" } };
    },
    getToken,
  };
});

describe("Authentication", () => {
  it("should return 401 when not authenticated", async () => {
    const req = new Request("http://localhost/");
    const res = await app.fetch(req);

    expect(res.status).toBe(401);
  });

  it("Should fail on invalid token", async () => {
    const req = new Request("http://localhost/", {
      headers: { Authorization: `Bearer ${invalidToken}` },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(403);
  });

  it("Should authenticate successfully with valid token", async () => {
    const req = new Request("http://localhost/", {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
  });
});

afterAll(() => {
  process.env.SKIP_AUTH = true;
});
