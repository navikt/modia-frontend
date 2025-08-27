import pino, { type DestinationStream, type LoggerOptions } from "pino";

type RequiredNaisFields = Record<string, string>;
type TeamLogConfigTuple = [
  DestinationStream | undefined,
  RequiredNaisFields,
  LoggerOptions,
];

function getConfig(): TeamLogConfigTuple {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NODE_ENV === "development"
  ) {
    const requiredFields = getTeamLogRequiredFields();
    return [
      pino.transport({
        target: "pino-socket",
        options: {
          address: "team-logs.nais-system",
          port: 5170,
          mode: "tcp",
        },
      }),
      requiredFields,
      {},
    ];
  }

  return [
    undefined,
    {},
    {
      msgPrefix: "[TEAM LOG (local dev)]: ",
    },
  ];
}

function getTeamLogRequiredFields(): Record<string, string> {
  const requiredFields = {
    google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT,
    nais_namespace_name: process.env.NAIS_NAMESPACE,
    nais_pod_name: process.env.NAIS_POD_NAME ?? process.env.HOSTNAME,
    nais_container_name: process.env.NAIS_APP_NAME,
  } as const;

  for (const [key, value] of Object.entries(requiredFields)) {
    if (value == null) {
      throw new Error(
        `Missing required field for team log: ${key}, is this running in nais k8s?`,
      );
    }
  }

  return requiredFields as Record<string, string>;
}

export const createLogger = (
  defaultConfig: LoggerOptions = {},
  destination?: DestinationStream,
): pino.Logger =>
  pino(
    {
      ...defaultConfig,
      timestamp: false,
      messageKey: "message",
      formatters: {
        level: (label) => {
          return { level: label };
        },
        log: (object: any) => {
          if (object.err) {
            const err =
              object.err instanceof Error
                ? pino.stdSerializers.err(object.err)
                : object.err;
            object.stack_trace = err.stack;
            object.type = err.type;
            object.message = err.message;
            object.status = err.status;
            delete object.err;
          }
          return object;
        },
      },
    },
    process.env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "development"
      ? destination
      : pino.transport({
          target: "pino-pretty",
          options: {
            colorize: true,
            ignore: "pid,hostname",
          },
        }),
  );

const createTeamLogger = (): pino.Logger => {
  const [transport, requiredFields, config] = getConfig();
  return createLogger(config, transport).child(requiredFields);
};

export const teamLogger = createTeamLogger();
export const logger = createLogger();
