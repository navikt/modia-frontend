import { describe, expect, it } from "bun:test";

import app from "../src/index";

const getHtml = async () => {
  const req = new Request("http://localhost/", {
    headers: { Accept: "text/html" },
  });
  const res = await app.fetch(req);
  expect(res.status).toBe(200);

  return await res.text();
};

describe("HTMLRewriter middleware env", () => {
  it("should correctly add env vars", async () => {
    let envRes = "";
    const html = await getHtml();

    const testRewriter = new HTMLRewriter().on("script[env-vars]", {
      text(chunk) {
        envRes += chunk.text;
      },
    });
    testRewriter.transform(html);

    // These are set in .env.test
    expect(envRes).toInclude('"PUBLIC_TESTING":"testing"');
    expect(envRes).toInclude('"PUBLIC_TEST_VAR":"testvar"');
    expect(envRes).not.toInclude("SECRET_VAR");
  });

  it("Should select correct <slot> based on environment", async () => {
    const html = await getHtml();
    const elements: { attributes: Record<string, string> }[] = [];

    new HTMLRewriter()
      .on("div[test-env]", {
        element(element) {
          elements.push({
            attributes: Object.fromEntries(element.attributes) as Record<
              string,
              string
            >,
          });
        },
      })
      .transform(html);

    expect(elements).toHaveLength(1);
    expect(elements[0].attributes).toHaveProperty("exists-in-not-prod");
  });

  it("Should set unleash properties properly", async () => {
    const html = await getHtml();
    let res = "";
    new HTMLRewriter()
      .on("script[unleash]", {
        text(chunk) {
          res += chunk.text;
        },
      })
      .transform(html);

    expect(res).toContain(JSON.stringify({ "test-toggle": true }));
  });
});
