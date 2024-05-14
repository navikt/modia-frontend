import { secureHeaders } from "hono/secure-headers";
import { logger } from "./logging";

declare module "bun" {
  interface Env {
    STATIC_FILES_DIR?: string;
    SKIP_AUTH?: boolean;
    BASE_PATH?: string;
    PROXY_CONFIG?: string;
  }
}

type ENV = (typeof process)["env"];

function getConfigVar<T extends keyof ENV>(name: T): ENV[T];
function getConfigVar<T extends keyof ENV, D extends NonNullable<ENV[T]>>(
  name: T,
  defaultValue: D,
): NonNullable<ENV[T]>;
function getConfigVar<T extends keyof ENV, D extends NonNullable<ENV[T]>>(
  name: T,
  defaultValue?: D,
): ENV[T] {
  const value = process.env[name];

  if (defaultValue === undefined && !value) {
    logger.error(`Missing required env var ${name}`);
    process.exit(1);
  }

  return value ?? defaultValue;
}

const config = {
  STATIC_FILES: getConfigVar("STATIC_FILES_DIR"),
  BASE_PATH: getConfigVar("BASE_PATH", ""),
  CONFIG: getConfigVar("CONFIG", ""),
  CONFIG_PATH: "./proxy-config.json",
};

type ConfigFile = {
  proxy: {
    [prefix: string]: {
      url: string;
      scope: string;
    };
  };
  contentSecurityPolicy:
    | NonNullable<Parameters<typeof secureHeaders>[0]>["contentSecurityPolicy"]
    | undefined;
};

const loadConfigFile = async (): Promise<ConfigFile | undefined> => {
  try {
    if (config.CONFIG) {
      logger.info("Reading configuration from CONFIG environment");
      const conf = (await JSON.parse(config.CONFIG)) as ConfigFile;
      return conf;
    } else {
      const confFile = Bun.file(config.CONFIG_PATH);
      if (await confFile.exists()) {
        logger.info(`Reading configuration from file (${confFile.name})`);
        const conf = (await confFile.json()) as ConfigFile;
        return conf;
      } else {
        logger.info(
          "No configuration file defined. No proxies will be configured",
        );
      }
    }
  } catch (e) {
    if (e instanceof Error) {
      logger.error(`Error parsing proxy config: ${e.message}`, {
        stackTrace: e.stack,
      });
    } else {
      logger.error("Error parsing proxy config");
    }
  }
};

export const fileConfig = await loadConfigFile();

export const env = {
  ENVIRONMENT: getConfigVar(
    "APP_ENVIRONMENT_NAME",
    getConfigVar("NAIS_CLUSTER_NAME", "dev"),
  ),
  NAIS_APP_NAME: process.env.NAIS_APP_NAME,
  // Unleash env vars are configured by nais
  UNLEASH_URL: process.env.UNLEASH_SERVER_API_URL ?? "",
  UNLEASH_ENV: process.env.UNLEASH_SERVER_API_ENV ?? "",
  UNLEASH_TOKEN: process.env.UNLEASH_SERVER_API_TOKEN ?? "",
};

export default config;
