import winston from "winston";

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format:
    process.env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.prettyPrint({ colorize: true }),
  transports: [new winston.transports.Console()],
  handleExceptions: true,
});

export const secureLog = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.json(),
    winston.format.printf((info) => {
      return JSON.stringify({
        ...info,
        severity: info.level,
        google_cloud_project: process.env.GOOGLE_CLOUD_PROJECT,
        nais_pod_name: process.env.NAIS_POD_NAME,
        nais_container_name: process.env.NAIS_APP_NAME,
        nais_namespace_name: process.env.NAIS_NAMESPACE,
      });
    }),
  ),
  transports: [
    new winston.transports.Http({
      host: "team-logs.nais-system",
      port: 80,
    }),
  ],
});
