/**
 * Environment-aware logging utility
 * Logs only in development and test environments
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

interface LoggerConfig {
  enabledInProduction: boolean
  enabledInDevelopment: boolean
  enabledInTest: boolean
}

const defaultConfig: LoggerConfig = {
  enabledInProduction: false,
  enabledInDevelopment: true,
  enabledInTest: true
}

/**
 * Determines if logging should be enabled based on current environment
 */
function shouldLog(config: LoggerConfig = defaultConfig): boolean {
  // Check if we're in Nuxt environment
  if (typeof process !== 'undefined') {
    const env = process.env.NODE_ENV
    
    switch (env) {
      case 'production':
        return config.enabledInProduction
      case 'test':
        return config.enabledInTest
      case 'development':
      default:
        return config.enabledInDevelopment
    }
  }
  
  // Fallback: check if we're in browser development mode
  if (typeof window !== 'undefined') {
    // In production builds, location.hostname is typically a real domain
    // In development, it's usually localhost or an IP
    const isDev = window.location.hostname === 'localhost' || 
                  window.location.hostname.startsWith('127.') ||
                  window.location.hostname.startsWith('192.168.') ||
                  window.location.hostname.includes('dev') ||
                  window.location.port !== ''
    
    return isDev ? config.enabledInDevelopment : config.enabledInProduction
  }
  
  // Default to development behavior if we can't determine environment
  return config.enabledInDevelopment
}

/**
 * Generic logging function
 */
function createLogger(level: LogLevel, config?: LoggerConfig) {
  return (...args: any[]) => {
    if (shouldLog(config)) {
      console[level](...args)
    }
  }
}

/**
 * Environment-aware logger
 */
export const logger = {
  /**
   * Debug level logging - only in development/test
   */
  debug: createLogger('debug'),
  
  /**
   * Info level logging - only in development/test
   */
  info: createLogger('info'),
  
  /**
   * Standard logging - only in development/test
   */
  log: createLogger('log'),
  
  /**
   * Warning level logging - only in development/test
   */
  warn: createLogger('warn'),
  
  /**
   * Error level logging - only in development/test
   */
  error: createLogger('error'),
  
  /**
   * Force logging regardless of environment (use sparingly)
   */
  force: {
    log: (...args: any[]) => console.log(...args),
    info: (...args: any[]) => console.info(...args),
    warn: (...args: any[]) => console.warn(...args),
    error: (...args: any[]) => console.error(...args),
    debug: (...args: any[]) => console.debug(...args)
  },
  
  /**
   * Configure logging behavior
   */
  configure: (config: Partial<LoggerConfig>) => {
    return {
      debug: createLogger('debug', { ...defaultConfig, ...config }),
      info: createLogger('info', { ...defaultConfig, ...config }),
      log: createLogger('log', { ...defaultConfig, ...config }),
      warn: createLogger('warn', { ...defaultConfig, ...config }),
      error: createLogger('error', { ...defaultConfig, ...config })
    }
  }
}

export default logger