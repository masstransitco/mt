const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

// Default to ERROR in production, INFO in development
let currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LOG_LEVELS.ERROR 
  : LOG_LEVELS.INFO;

export const logger = {
  error: (message: string, ...args: any[]) => {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.error(message, ...args);
    }
  },
  warn: (message: string, ...args: any[]) => {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.warn(message, ...args);
    }
  },
  info: (message: string, ...args: any[]) => {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.info(message, ...args);
    }
  },
  debug: (message: string, ...args: any[]) => {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.debug(message, ...args);
    }
  },
  setLevel: (level: number) => {
    currentLogLevel = level;
    console.log(`Log level set to: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key as keyof typeof LOG_LEVELS] === level)}`);
  },
  getLevel: () => currentLogLevel
};

// Shorthand for common development-only logs
export const devLog = process.env.NODE_ENV === 'production' 
  ? (...args: any[]) => {} 
  : (...args: any[]) => logger.debug(...args);

// Export LOG_LEVELS for external use
export { LOG_LEVELS };