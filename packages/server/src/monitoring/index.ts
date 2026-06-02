// Monitoring setup
import { logger } from "../utils/logger"
import { redis } from "../config/redis"

export function setupMonitoring() {
  // Health check interval
  setInterval(async () => {
    try {
      // Check database connection
      // Check Redis connection
      await redis.ping()

      logger.debug("Health check passed")
    } catch (error) {
      logger.error("Health check failed", { error: String(error) })
    }
  }, 30000) // Every 30 seconds

  // Metrics collection interval
  setInterval(async () => {
    try {
      const metrics = await collectMetrics()
      logger.debug("Metrics collected", metrics)
    } catch (error) {
      logger.error("Failed to collect metrics", { error: String(error) })
    }
  }, 60000) // Every minute
}

async function collectMetrics() {
  return {
    timestamp: Date.now(),
    memory: process.memoryUsage?.() || null,
    uptime: process.uptime?.() || null,
  }
}
