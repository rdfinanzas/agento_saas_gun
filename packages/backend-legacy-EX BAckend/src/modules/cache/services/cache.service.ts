/**
 * Cache Service - Servicio de caché distribuido con Redis
 *
 * Fase 6: Optimización - Caché de sesiones y datos frecuentes
 */

import { createClient, RedisClientType } from 'redis';

// ============================================
// Interfaces
// ============================================

export interface CacheOptions {
  ttl?: number; // Time to live en segundos
  key?: string; // Key personalizada
}

export interface CacheStats {
  totalKeys: number;
  hitRate: number;
  missRate: number;
  memoryUsage: number;
  keysByPattern: Record<string, number>;
}

// ============================================
// Servicio Principal
// ============================================

export class CacheService {
  private client: RedisClientType;
  private enabled: boolean;
  private defaultTTL: number = 3600; // 1 hora
  private metrics: {
    hits: number;
    misses: number;
    sets: number;
    deletes: number;
  };

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            console.error('[Cache] Max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          return retries * 100; // Reintentar con backoff exponencial
        },
      },
    });

    this.enabled = process.env.CACHE_ENABLED !== 'false';
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };

    this.setupEventHandlers();
  }

  /**
   * Conecta a Redis
   */
  async connect(): Promise<void> {
    if (!this.enabled) {
      console.log('[Cache] Cache is disabled');
      return;
    }

    try {
      await this.client.connect();
      console.log('[Cache] Connected to Redis');
    } catch (error) {
      console.error('[Cache] Failed to connect to Redis:', error);
      this.enabled = false;
    }
  }

  /**
   * Desconecta de Redis
   */
  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  /**
   * Obtiene un valor del caché
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const value = await this.client.get(key);

      if (value) {
        this.metrics.hits++;
        return JSON.parse(value) as T;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error(`[Cache] Error getting key "${key}":`, error);
      return null;
    }
  }

  /**
   * Obtiene un valor raw del caché (sin parsear JSON)
   */
  async getRaw(key: string): Promise<string | null> {
    if (!this.enabled) return null;

    try {
      const value = await this.client.get(key);

      if (value) {
        this.metrics.hits++;
        return value;
      }

      this.metrics.misses++;
      return null;
    } catch (error) {
      console.error(`[Cache] Error getting key "${key}":`, error);
      return null;
    }
  }

  /**
   * Establece un valor en el caché
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const ttl = options.ttl ?? this.defaultTTL;
      const serialized = JSON.stringify(value);

      await this.client.setEx(key, ttl, serialized);
      this.metrics.sets++;

      return true;
    } catch (error) {
      console.error(`[Cache] Error setting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Elimina un valor del caché
   */
  async delete(key: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await this.client.del(key);
      this.metrics.deletes++;
      return true;
    } catch (error) {
      console.error(`[Cache] Error deleting key "${key}":`, error);
      return false;
    }
  }

  /**
   * Elimina múltiples keys por patrón
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.enabled) return 0;

    try {
      const keys = await this.client.keys(pattern);

      if (keys.length > 0) {
        await this.client.del(keys);
        this.metrics.deletes += keys.length;
      }

      return keys.length;
    } catch (error) {
      console.error(`[Cache] Error deleting pattern "${pattern}":`, error);
      return 0;
    }
  }

  /**
   * Verifica si una key existe
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error(`[Cache] Error checking key "${key}":`, error);
      return false;
    }
  }

  /**
   * Establece TTL a una key existente
   */
  async expire(key: string, ttl: number): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await this.client.expire(key, ttl);
      return true;
    } catch (error) {
      console.error(`[Cache] Error setting TTL for key "${key}":`, error);
      return false;
    }
  }

  /**
   * Obtiene el TTL restante de una key
   */
  async ttl(key: string): Promise<number> {
    if (!this.enabled) return -1;

    try {
      return await this.client.ttl(key);
    } catch (error) {
      console.error(`[Cache] Error getting TTL for key "${key}":`, error);
      return -1;
    }
  }

  /**
   * Busca keys por patrón
   */
  async keys(pattern: string): Promise<string[]> {
    if (!this.enabled) return [];

    try {
      return await this.client.keys(pattern);
    } catch (error) {
      console.error(`[Cache] Error finding keys with pattern "${pattern}":`, error);
      return [];
    }
  }

  /**
   * Incrementa un contador
   */
  async incr(key: string, amount: number = 1): Promise<number> {
    if (!this.enabled) return 0;

    try {
      return await this.client.incrBy(key, amount);
    } catch (error) {
      console.error(`[Cache] Error incrementing key "${key}":`, error);
      return 0;
    }
  }

  /**
   * Obtiene o establece un valor (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Intentar obtener del caché
    const cached = await this.get<T>(key);

    if (cached !== null) {
      return cached;
    }

    // Si no está en caché, ejecutar factory y guardar
    const value = await factory();
    await this.set(key, value, options);

    return value;
  }

  /**
   * Obtiene estadísticas del caché
   */
  async getStats(pattern: string = '*'): Promise<CacheStats> {
    if (!this.enabled) {
      return {
        totalKeys: 0,
        hitRate: 0,
        missRate: 0,
        memoryUsage: 0,
        keysByPattern: {},
      };
    }

    try {
      const keys = await this.client.keys(pattern);
      const keysByPattern: Record<string, number> = {};

      // Agrupar keys por patrón
      for (const key of keys) {
        const prefix = key.split(':')[0];
        keysByPattern[prefix] = (keysByPattern[prefix] || 0) + 1;
      }

      // Obtener info de memoria
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : '0B';

      // Calcular hit/miss rate
      const total = this.metrics.hits + this.metrics.misses;
      const hitRate = total > 0 ? this.metrics.hits / total : 0;
      const missRate = total > 0 ? this.metrics.misses / total : 0;

      return {
        totalKeys: keys.length,
        hitRate,
        missRate,
        memoryUsage: parseInt(memoryUsage) || 0,
        keysByPattern,
      };
    } catch (error) {
      console.error('[Cache] Error getting stats:', error);
      return {
        totalKeys: 0,
        hitRate: 0,
        missRate: 0,
        memoryUsage: 0,
        keysByPattern: {},
      };
    }
  }

  /**
   * Limpia todo el caché
   */
  async flush(): Promise<boolean> {
    if (!this.enabled) return false;

    try {
      await this.client.flushDb();
      return true;
    } catch (error) {
      console.error('[Cache] Error flushing cache:', error);
      return false;
    }
  }

  /**
   * Obtiene métricas de operaciones
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Resetea métricas de operaciones
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
    };
  }

  // ============================================
  // Helpers para keys comunes
  // ============================================

  /**
   * Genera key para datos de agente
   */
  static agentKey(tenantId: string, agentId: string): string {
    return `agent:${tenantId}:${agentId}`;
  }

  /**
   * Genera key para sesión
   */
  static sessionKey(tenantId: string, agentId: string, identifier: string): string {
    return `session:${tenantId}:${agentId}:${identifier}`;
  }

  /**
   * Genera key para caché de respuestas
   */
  static responseKey(tenantId: string, agentId: string, promptHash: string): string {
    return `response:${tenantId}:${agentId}:${promptHash}`;
  }

  /**
   * Genera key para rate limiting
   */
  static rateLimitKey(identifier: string, window: string): string {
    return `ratelimit:${identifier}:${window}`;
  }

  /**
   * Genera key para métricas
   */
  static metricsKey(tenantId: string, type: string, date: string): string {
    return `metrics:${tenantId}:${type}:${date}`;
  }

  // ============================================
  // Event Handlers
  // ============================================

  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      console.error('[Cache] Redis error:', error);
    });

    this.client.on('connect', () => {
      console.log('[Cache] Connecting to Redis...');
    });

    this.client.on('ready', () => {
      console.log('[Cache] Redis ready');
    });

    this.client.on('reconnecting', () => {
      console.log('[Cache] Reconnecting to Redis...');
    });

    this.client.on('end', () => {
      console.log('[Cache] Redis connection ended');
    });
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const cacheService = new CacheService();

// Auto-conectar al importar
cacheService.connect().catch(console.error);
