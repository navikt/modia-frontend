import { MiddlewareHandler } from "hono";
import { unleash } from "../unleash";
import { env } from "../config";
import { HonoEnv } from "..";

class EnvironmentRewriter
  implements HTMLRewriterTypes.HTMLRewriterElementContentHandlers
{
  #notEnvironmentField(value: string | null) {
    return value && value.length > 0 && value !== env.ENVIRONMENT;
  }

  element(element: HTMLRewriterTypes.Element) {
    if (
      element.getAttribute("environment") === env.ENVIRONMENT ||
      this.#notEnvironmentField(element.getAttribute("not-environment"))
    ) {
      element.removeAndKeepContent();
    } else {
      element.remove();
    }
  }
}

class UnleashRewriter
  implements HTMLRewriterTypes.HTMLRewriterElementContentHandlers
{
  userId?: string;

  constructor({ userId }: { userId?: string }) {
    this.userId = userId;
  }
  element(element: HTMLRewriterTypes.Element) {
    const client = unleash;
    if (!client) return;

    const toggles = element.getAttribute("toggles")?.split(",");

    const res: { [toggle: string]: boolean } = {};
    if (toggles) {
      toggles.forEach((toggle) => {
        res[toggle.replaceAll(".", "_")] = client.isEnabled(toggle, {
          userId: this.userId,
        });
      });
    }

    element.prepend(`
                    unleash = ${JSON.stringify(res)};
                    `);
  }
}

export const htmlRewriterMiddleware: MiddlewareHandler<HonoEnv> = async (
  c,
  next,
) => {
  await next();

  if (c.res.headers.get("Content-Type")?.startsWith("text/html")) {
    const rewriter = new HTMLRewriter().on("slot", new EnvironmentRewriter());
    if (unleash) {
      const userId = c.get("userId");
      rewriter.on("script[unleash]", new UnleashRewriter({ userId }));
    }
    // We are creating a new response here and reading the text from the existing response due to a
    // bug in bun: https://github.com/oven-sh/bun/issues/6068
    c.res = new Response(rewriter.transform(await c.res.text()), {
      headers: c.res.headers,
      status: c.res.status,
    });
  }
};
