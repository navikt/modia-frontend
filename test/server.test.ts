import { describe, expect, it } from "bun:test";

import app from "../src/index";
import config from "../src/config";
import path from "node:path";

describe("Static files", () => {
  it("should return 200 with accept: text/html", async () => {
    const req = new Request("http://localhost/", {
      headers: { Accept: "text/html,image/webp" },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
  });

  it("Should return 404 for requests not accepting html", async () => {
    const req = new Request("http://localhost/not-existing", {
      headers: { Accept: "*/*" },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(404);
  });

  it("Should return 200/HTML for requests accepting html", async () => {
    const req = new Request("http://localhost/not-existing", {
      headers: { Accept: "text/html" },
    });
    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<html");
  });

  it("Should return a static file when it exists", async () => {
    const req = new Request("http://localhost/static/test.js");

    const res = await app.fetch(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toEqual(
      await Bun.file(
        path.join(config.STATIC_FILES ?? "", "static", "test.js"),
      ).text(),
    );
  });
});
