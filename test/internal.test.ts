import { describe, expect, it, beforeAll } from "bun:test";

import app from "../src/index";
import { register } from "prom-client";

const getInternal = async (path: string) => {
  const req = new Request("http://localhost/internal/" + path);
  return await app.fetch(req);
};

describe("Interal endpoints (metrics, liveness, readiness)", () => {
  beforeAll(() => {
    register.resetMetrics();
  });

  it("should return 200 for liveness", async () => {
    const res = await getInternal("liveness");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("Should return 200 for readiness", async () => {
    const res = await getInternal("readiness");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("Should expose metrics", async () => {
    await app.fetch(new Request("http://localhost/"));
    const res = await getInternal("metrics");

    const text = await res.text();
    expect(text).toContain(
      'http_requests_total{method="GET",route="/*",status="200",ok="true"} 1',
    );
  });
});
