import { logger } from "./logging";

declare module "bun" {
  interface Env {
    STATIC_FILES_DIR: string;
    SKIP_AUTH?: boolean;
    BASE_PATH?: string;
  }
}

type ENV = (typeof process)["env"];

function getConfigVar<T extends keyof ENV>(name: T): NonNullable<ENV[T]>;
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
  SKIP_AUTH: getConfigVar("SKIP_AUTH", false),
  BASE_PATH: getConfigVar("BASE_PATH", ""),
};

export default config;
