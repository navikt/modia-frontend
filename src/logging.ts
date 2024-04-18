import winston from "winston";
import { existsSync } from "node:fs";

export const logger = winston.createLogger({
  level: "info",
  format:
    import.meta.env.NODE_ENV === "production"
      ? winston.format.json()
      : winston.format.prettyPrint(),
  transports: [new winston.transports.Console()],
  handleExceptions: true,
});

const securelogFile = existsSync("/secure-log/")
  ? "/secure-log/secure.log"
  : "./secure.log";

export const secureLog = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      maxFiles: 2,
      maxsize: 5242880,
      filename: securelogFile,
    }),
  ],
});
