// Simple logger utility
import { env } from "../config/env"

type LogLevel = "debug" | "info" | "warn" | "error"

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class Logger {
  private context: string
  private level: LogLevel

  constructor(context: string) {
    this.context = context
    this.level = env.NODE_ENV === "production" ? "info" : "debug"
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const levelStr = level.toUpperCase().padEnd(5)
    const dataStr = data ? ` ${JSON.stringify(data)}` : ""
    return `${timestamp} [${levelStr}] [${this.context}] ${message}${dataStr}`
  }

  debug(message: string, data?: any) {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.debug) {
      console.debug(this.formatMessage("debug", message, data))
    }
  }

  info(message: string, data?: any) {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.info) {
      console.info(this.formatMessage("info", message, data))
    }
  }

  warn(message: string, data?: any) {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.warn) {
      console.warn(this.formatMessage("warn", message, data))
    }
  }

  error(message: string, data?: any) {
    if (LOG_LEVELS[this.level] <= LOG_LEVELS.error) {
      console.error(this.formatMessage("error", message, data))
    }
  }
}

// Factory function
export function createLogger(context: string): Logger {
  return new Logger(context)
}

// Default logger
export const logger = createLogger("app")
