import { logger } from "./logging";

declare module "bun" {
  interface Env {
    STATIC_FILES_DIR: string;
    SKIP_AUTH?: boolean;
  }
}

type ENV = (typeof process)["env"];

const getConfigVar = <T extends keyof ENV>(name: T, defaultValue?: ENV[T]) => {
  const value = process.env[name];

  if (defaultValue === undefined && !value) {
    logger.error(`Missing required env var ${name}`);
    process.exit(1);
  }

  return value ?? defaultValue;
};

const config = {
  STATIC_FILES: getConfigVar("STATIC_FILES_DIR"),
  SKIP_AUTH: getConfigVar("SKIP_AUTH", false),
};

export default config;
