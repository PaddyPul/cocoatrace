import pino from 'pino';
import { config } from './config/env';

const transport = config.isDeployed
  ? undefined
  : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'HH:MM:ss' },
    };

const logger = pino({
  level: config.logLevel || (config.isDeployed ? 'info' : 'debug'),
  transport,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
