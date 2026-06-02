// Redis configuration
import Redis from "ioredis"
import { env } from "./env"
import { createLogger } from "../utils/logger"

const logger = createLogger("redis")

// Check if Redis is configured
const isRedisConfigured = !!(env.REDIS_URL || env.REDIS_HOST)

// ============================================
// In-Memory Cache Fallback (when Redis not available)
// ============================================

class MemoryCacheClient {
  private cache = new Map<string, { value: string; expiresAt: number }>()

  async get(key: string): Promise<string | null> {
    const item = this.cache.get(key)
    if (!item) return null
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      return null
    }
    return item.value
  }

  async set(key: string, value: string): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + 86400000 }) // 24h default
  }

  async setex(key: string, ttl: number, value: string): Promise<void> {
    this.cache.set(key, { value, expiresAt: Date.now() + ttl * 1000 })
  }

  async del(...keys: string[]): Promise<number> {
    keys.forEach((k) => this.cache.delete(k))
    return keys.length
  }

  async exists(key: string): Promise<number> {
    const item = this.cache.get(key)
    if (!item || Date.now() > item.expiresAt) return 0
    return 1
  }

  async expire(key: string, ttl: number): Promise<number> {
    const item = this.cache.get(key)
    if (!item) return 0
    item.expiresAt = Date.now() + ttl * 1000
    return 1
  }

  async ttl(key: string): Promise<number> {
    const item = this.cache.get(key)
    if (!item) return -1
    return Math.max(0, Math.floor((item.expiresAt - Date.now()) / 1000))
  }

  async ping(): Promise<string> {
    return "PONG"
  }

  async info(): Promise<string> {
    return "connected_clients:1\nused_memory_human:0B\ntotal_connections_received:1\ntotal_commands_processed:0\nkeyspace_hits:0\nkeyspace_misses:0"
  }
}

// Cleanup expired memory cache entries periodically
const memoryCache = new MemoryCacheClient()

if (!isRedisConfigured) {
  logger.warn("Redis no configurado - usando cache en memoria (no persistente)")
  setInterval(() => {
    // Memory cache self-cleans on access
  }, 60000)
}

// ============================================
// Redis Connection Options
// ============================================

export interface RedisConnectionOptions {
  host: string
  port: number
  password?: string
  db: number
  maxRetriesPerRequest: number | null
  enableReadyCheck: boolean
  retryStrategy?: (times: number) => number | null
}

/**
 * Configuracion base para conexion Redis
 */
const baseRedisOptions: RedisConnectionOptions = {
  host: env.REDIS_HOST || "localhost",
  port: Number(env.REDIS_PORT) || 6379,
  password: env.REDIS_PASSWORD || undefined,
  db: Number(env.REDIS_DB) || 0,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

/**
 * Estrategia de reintentos para conexion Redis
 */
function retryStrategy(times: number): number | null {
  const delay = Math.min(times * 50, 2000)
  logger.warn(`Reintentando conexion Redis (intento ${times}, delay: ${delay}ms)`)
  return delay
}

// ============================================
// Redis Client for General Use (Cache, Sessions)
// ============================================

let _redisClient: Redis | MemoryCacheClient | null = null

/**
 * Obtiene el cliente de cache (Redis o memoria)
 */
async function getCacheClient(): Promise<Redis | MemoryCacheClient> {
  if (_redisClient) return _redisClient

  if (!isRedisConfigured) {
    _redisClient = memoryCache
    return _redisClient
  }

  try {
    const client = new Redis({
      ...baseRedisOptions,
      retryStrategy,
      lazyConnect: true,
    })

    await client.ping()
    _redisClient = client

    client.on("connect", () => {
      logger.info(`Conectado a Redis: ${baseRedisOptions.host}:${baseRedisOptions.port}`)
    })

    client.on("error", (error) => {
      logger.error("Error en conexion Redis:", error.message)
    })

    client.on("close", () => {
      logger.warn("Conexion Redis cerrada")
    })

    return _redisClient
  } catch (error) {
    logger.error("Fallo conexion Redis, Usando cache en memoria:", error)
    _redisClient = memoryCache
    return _redisClient
  }
}

/**
 * Cliente Redis principal para uso general
 * - Cache de sesiones
 * - Cache de datos
 * - Operaciones generales
 */
export const redis: Redis | MemoryCacheClient = isRedisConfigured
  ? new Redis({
      ...baseRedisOptions,
      retryStrategy,
      lazyConnect: false,
    })
  : memoryCache

// Event handlers para el cliente Redis (solo si está configurado)
if (isRedisConfigured && redis instanceof Redis) {
  ;(redis as Redis).on("connect", () => {
    logger.info(`Conectado a Redis: ${baseRedisOptions.host}:${baseRedisOptions.port}`)
  })

  ;(redis as Redis).on("error", (error) => {
    logger.error("Error en conexion Redis:", error.message)
  })

  ;(redis as Redis).on("close", () => {
    logger.warn("Conexion Redis cerrada")
  })

  ;(redis as Redis).on("reconnecting", () => {
    logger.info("Reconectando a Redis...")
  })
}

// ============================================
// Redis Connection for BullMQ
// ============================================

export const redisConnection: RedisConnectionOptions = {
  ...baseRedisOptions,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

/**
 * Crea una nueva conexion Redis para uso con BullMQ
 * Cada worker debe tener su propia conexion
 */
export function createRedisConnection(): Redis {
  if (!isRedisConfigured) {
    // Return memory cache as mock for BullMQ compatibility
    return memoryCache as unknown as Redis
  }
  return new Redis({
    ...redisConnection,
    retryStrategy,
    lazyConnect: true,
  })
}

// ============================================
// Cache Helpers
// ============================================

/**
 * Obtiene un valor del cache
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const client = await getCacheClient()
    const data = await client.get(key)
    if (!data) return null
    return JSON.parse(data) as T
  } catch (error) {
    logger.error(`Error al obtener cache key ${key}:`, error)
    return null
  }
}

/**
 * Guarda un valor en el cache con TTL
 */
export async function cacheSet<T>(key: string, value: T, ttl: number = 3600): Promise<void> {
  try {
    const client = await getCacheClient()
    await client.setex(key, ttl, JSON.stringify(value))
  } catch (error) {
    logger.error(`Error al guardar cache key ${key}:`, error)
  }
}

/**
 * Elimina una clave del cache
 */
export async function cacheDel(key: string): Promise<void> {
  try {
    const client = await getCacheClient()
    await client.del(key)
  } catch (error) {
    logger.error(`Error al eliminar cache key ${key}:`, error)
  }
}

/**
 * Verifica si una clave existe
 */
export async function cacheExists(key: string): Promise<boolean> {
  try {
    const client = await getCacheClient()
    const result = await client.exists(key)
    return result === 1
  } catch (error) {
    logger.error(`Error al verificar cache key ${key}:`, error)
    return false
  }
}

/**
 * Establece TTL a una clave existente
 */
export async function cacheExpire(key: string, ttl: number): Promise<boolean> {
  try {
    const client = await getCacheClient()
    const result = await client.expire(key, ttl)
    return result === 1
  } catch (error) {
    logger.error(`Error al establecer TTL a key ${key}:`, error)
    return false
  }
}

/**
 * Obtiene el TTL restante de una clave
 */
export async function cacheTTL(key: string): Promise<number> {
  try {
    const client = await getCacheClient()
    return await client.ttl(key)
  } catch (error) {
    logger.error(`Error al obtener TTL de key ${key}:`, error)
    return -1
  }
}

// ============================================
// Session Cache (for OpenCode sessions)
// ============================================

const SESSION_TTL = 1800 // 30 minutos

/**
 * Guarda datos de sesion en cache
 */
export async function cacheSession(sessionId: string, data: unknown): Promise<void> {
  await cacheSet(`session:${sessionId}`, data, SESSION_TTL)
}

/**
 * Obtiene datos de sesion del cache
 */
export async function getSession<T = unknown>(sessionId: string): Promise<T | null> {
  return cacheGet<T>(`session:${sessionId}`)
}

/**
 * Elimina una sesion del cache
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await cacheDel(`session:${sessionId}`)
}

/**
 * Refresca el TTL de una sesion
 */
export async function refreshSession(sessionId: string): Promise<boolean> {
  return cacheExpire(`session:${sessionId}`, SESSION_TTL)
}

// ============================================
// Pub/Sub Helpers
// ============================================

/**
 * Crea un publisher Redis
 */
export function createPublisher(): Redis {
  if (!isRedisConfigured) {
    return memoryCache as unknown as Redis
  }
  return new Redis({
    ...baseRedisOptions,
    retryStrategy,
  })
}

/**
 * Crea un subscriber Redis
 */
export function createSubscriber(): Redis {
  if (!isRedisConfigured) {
    return memoryCache as unknown as Redis
  }
  return new Redis({
    ...baseRedisOptions,
    retryStrategy,
  })
}

// ============================================
// Health Check
// ============================================

/**
 * Verifica el estado de la conexion Redis
 */
export async function redisHealthCheck(): Promise<{
  status: "ok" | "error"
  latency?: number
  error?: string
}> {
  try {
    const start = Date.now()
    const client = await getCacheClient()
    await client.ping()
    const latency = Date.now() - start

    return {
      status: "ok",
      latency,
    }
  } catch (error) {
    return {
      status: "error",
      error: error instanceof Error ? error.message : "Error desconocido",
    }
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Limpia todas las claves que coincidan con un patron
 * Usar con precaucion
 */
export async function clearKeysByPattern(pattern: string): Promise<number> {
  if (!isRedisConfigured) {
    logger.warn("clearKeysByPattern no disponible en modo memoria")
    return 0
  }

  let deleted = 0
  const redisClient = redis as Redis
  const stream = redisClient.scanStream({
    match: pattern,
    count: 100,
  })

  return new Promise((resolve, reject) => {
    stream.on("data", async (keys: string[]) => {
      if (keys.length > 0) {
        await redisClient.del(...keys)
        deleted += keys.length
      }
    })

    stream.on("end", () => {
      logger.info(`Limpiadas ${deleted} claves con patron: ${pattern}`)
      resolve(deleted)
    })

    stream.on("error", (error) => {
      logger.error(`Error al limpiar claves con patron ${pattern}:`, error)
      reject(error)
    })
  })
}

/**
 * Obtiene estadisticas de Redis
 */
export async function getRedisStats(): Promise<{
  connected_clients: number
  used_memory_human: string
  total_connections_received: number
  total_commands_processed: number
  keyspace_hits: number
  keyspace_misses: number
}> {
  const client = await getCacheClient()
  const info = await client.info()
  const stats = {
    connected_clients: 0,
    used_memory_human: "0B",
    total_connections_received: 0,
    total_commands_processed: 0,
    keyspace_hits: 0,
    keyspace_misses: 0,
  }

  const lines = info.split("\r\n")
  for (const line of lines) {
    const [key, value] = line.split(":")
    if (key && value) {
      switch (key) {
        case "connected_clients":
          stats.connected_clients = parseInt(value, 10)
          break
        case "used_memory_human":
          stats.used_memory_human = value
          break
        case "total_connections_received":
          stats.total_connections_received = parseInt(value, 10)
          break
        case "total_commands_processed":
          stats.total_commands_processed = parseInt(value, 10)
          break
        case "keyspace_hits":
          stats.keyspace_hits = parseInt(value, 10)
          break
        case "keyspace_misses":
          stats.keyspace_misses = parseInt(value, 10)
          break
      }
    }
  }

  return stats
}
