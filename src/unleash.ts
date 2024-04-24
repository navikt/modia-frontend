import { Unleash } from "unleash-client";
import { env } from "./config";
import { logger } from "./logging";

export const unleash = env.UNLEASH_URL
  ? new Unleash({
      url: env.UNLEASH_URL ? env.UNLEASH_URL + "/api" : "",
      appName: env.NAIS_APP_NAME ?? "modia-frontend",
      environment: env.UNLEASH_ENV,
      customHeaders: { Authorization: env.UNLEASH_TOKEN },
    })
  : undefined;

if (!unleash) {
  logger.info(
    "UNLEASH_SERVER_API_URL not configured. Unleash features are not enabled",
  );
}

unleash?.on("ready", () => logger.info("Unleash client is ready"));
