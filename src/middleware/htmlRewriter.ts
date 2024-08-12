import { trace } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import type { HonoEnv } from "..";
import { env } from "../config";
import { logger } from "../logging";
import { unleash } from "../unleash";

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
type ENV = { [key: string]: string };
const env_prefix_cache: { [prefix: string]: ENV } = {};

class EnvironmentVarRewriter
  implements HTMLRewriterTypes.HTMLRewriterElementContentHandlers
{
  #getPrefixVars(prefix: string): ENV {
    if (env_prefix_cache[prefix]) {
      return env_prefix_cache[prefix];
    }
    env_prefix_cache[prefix] = Object.fromEntries(
      Object.entries(import.meta.env).filter(([key]) => {
        return key.startsWith(prefix);
      }),
    ) as ENV;

    return env_prefix_cache[prefix];
  }

  element(element: HTMLRewriterTypes.Element) {
    const prefix = element.getAttribute("prefix");
    if (prefix && prefix.length > 0) {
      const env = this.#getPrefixVars(prefix);
      element.setInnerContent(`
        window.__ENV__ = ${JSON.stringify(env)}
    `);
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
    if (!client) {
      logger.warn(
        "Removing unleash script. Client could not be found or is not set up properly",
      );
      element.remove();
      return;
    }

    const toggles = element.getAttribute("toggles")?.split(",");

    const res: { [toggle: string]: boolean } = {};
    if (toggles) {
      for (const toggle of toggles) {
        res[toggle.replaceAll(".", "_")] = client.isEnabled(toggle, {
          userId: this.userId,
        });
      }
    }

    element.prepend(`
              const unleash = ${JSON.stringify(res)};
              `);
  }
}

const tracer = trace.getTracer("modia-frontend:middleware");

export const htmlRewriterMiddleware: MiddlewareHandler<HonoEnv> = async (
  c,
  next,
) => {
  await next();

  await tracer.startActiveSpan("htmlrewrite", async (span) => {
    if (c.res.headers.get("Content-Type")?.startsWith("text/html")) {
      logger.debug("Running HTML rewrite middleware on response", {
        contentType: c.res.headers.get("Content-Type"),
        status: c.res.status,
      });
      const rewriter = new HTMLRewriter();
      rewriter.on("slot", new EnvironmentRewriter());
      rewriter.on("script[env-vars]", new EnvironmentVarRewriter());

      const userId = c.get("userId");
      rewriter.on("script[unleash]", new UnleashRewriter({ userId }));

      // We are creating a new response here and reading the text from the existing response due to a
      // bug in bun: https://github.com/oven-sh/bun/issues/6068
      c.res = new Response(rewriter.transform(await c.res.text()), {
        headers: c.res.headers,
        status: c.res.status,
      });
    }
    span.end();
  });
};
