// src/utils/logger.ts
import winston from 'winston';

export class Logger {
  private logger: winston.Logger;

  constructor(service: string) {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service },
      transports: [
        new winston.transports.File({
          filename: `logs/${service}-error.log`,
          level: 'error',
        }),
        new winston.transports.File({
          filename: `logs/${service}-combined.log`,
        }),
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  info(message: string, ...meta: any[]) {
    this.logger.info(message, ...meta);
  }

  error(message: string, ...meta: any[]) {
    this.logger.error(message, ...meta);
  }

  warn(message: string, ...meta: any[]) {
    this.logger.warn(message, ...meta);
  }

  debug(message: string, ...meta: any[]) {
    this.logger.debug(message, ...meta);
  }
}