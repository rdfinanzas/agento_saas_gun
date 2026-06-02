/**
 * Rate Limit Service - Límite de solicitudes por usuario/tenant
 *
 * Fase 6: Optimización - Rate limiting con Redis
 */

import { cacheService, CacheService } from '../cache/services/cache.service';

// ============================================
// Interfaces
// ============================================

export interface RateLimitConfig {
  /** Número máximo de solicitudes permitidas */
  limit: number;
  /** Ventana de tiempo en segundos */
  window: number;
  /** Tipo de límite (por tenant, usuario, IP, etc.) */
  type: 'tenant' | 'user' | 'ip' | 'global' | 'custom';
}

export interface RateLimitResult {
  /** Si la solicitud está permitida */
  allowed: boolean;
  /** Solicitudes restantes en la ventana actual */
  remaining: number;
  /** Tiempo en segundos hasta que se resetee el límite */
  resetTime: number;
  /** Límite actual */
  limit: number;
}

export interface RateLimitInfo {
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
}

// ============================================
// Configuración por defecto
// ============================================

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Límites para endpoints de chat
  chat: {
    limit: 100,
    window: 60, // 100 solicitudes por minuto
    type: 'tenant',
  },

  // Límites para endpoints de webhook
  webhook: {
    limit: 1000,
    window: 60, // 1000 solicitudes por minuto
    type: 'tenant',
  },

  // Límites para endpoints de administración
  admin: {
    limit: 50,
    window: 60, // 50 solicitudes por minuto
    type: 'user',
  },

  // Límites para API pública
  public: {
    limit: 20,
    window: 60, // 20 solicitudes por minuto
    type: 'ip',
  },

  // Límites para creación de agentes
  createAgent: {
    limit: 5,
    window: 3600, // 5 agentes por hora
    type: 'tenant',
  },

  // Límites para Master Agent
  masterAgent: {
    limit: 30,
    window: 60, // 30 solicitudes por minuto
    type: 'tenant',
  },
};

// ============================================
// Servicio Principal
// ============================================

export class RateLimitService {
  private cache: CacheService;

  constructor() {
    this.cache = cacheService;
  }

  /**
   * Verifica si una solicitud está dentro del límite
   */
  async checkLimit(
    identifier: string,
    configOrKey: string | RateLimitConfig,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitResult> {
    const config = this.getConfig(configOrKey, customConfig);
    const key = CacheService.rateLimitKey(identifier, this.getWindowKey(config.window));

    // Incrementar contador
    const current = await this.cache.incr(key);

    // Si es la primera solicitud, establecer TTL
    if (current === 1) {
      await this.cache.expire(key, config.window);
    }

    const remaining = Math.max(0, config.limit - current);
    const resetTime = await this.cache.ttl(key);

    return {
      allowed: current <= config.limit,
      remaining,
      resetTime,
      limit: config.limit,
    };
  }

  /**
   * Obtiene información actual del rate limit
   */
  async getInfo(
    identifier: string,
    configOrKey: string | RateLimitConfig,
    customConfig?: RateLimitConfig
  ): Promise<RateLimitInfo> {
    const config = this.getConfig(configOrKey, customConfig);
    const key = CacheService.rateLimitKey(identifier, this.getWindowKey(config.window));

    // Obtener valor actual sin incrementar
    const currentStr = await this.cache.getRaw(key);
    const current = currentStr ? parseInt(currentStr, 10) : 0;

    const ttl = await this.cache.ttl(key);
    const resetAt = new Date(Date.now() + ttl * 1000);

    return {
      current,
      limit: config.limit,
      remaining: Math.max(0, config.limit - current),
      resetAt,
    };
  }

  /**
   * Resetea el contador de rate limit
   */
  async resetLimit(
    identifier: string,
    configOrKey: string | RateLimitConfig,
    customConfig?: RateLimitConfig
  ): Promise<boolean> {
    const config = this.getConfig(configOrKey, customConfig);
    const key = CacheService.rateLimitKey(identifier, this.getWindowKey(config.window));

    return await this.cache.delete(key);
  }

  /**
   * Verifica múltiples límites a la vez
   */
  async checkMultipleLimits(
    identifier: string,
    configs: Array<string | RateLimitConfig>
  ): Promise<{ allowed: boolean; results: RateLimitResult[] }> {
    const results = await Promise.all(
      configs.map(config => this.checkLimit(identifier, config))
    );

    const allowed = results.every(r => r.allowed);

    return { allowed, results };
  }

  /**
   * Middleware de Express para rate limiting
   */
  middleware(configOrKey: string | RateLimitConfig, customConfig?: RateLimitConfig) {
    return async (req: any, res: any, next: any) => {
      // Determinar identificador según el tipo
      const config = this.getConfig(configOrKey, customConfig);
      const identifier = this.getIdentifier(req, config);

      // Verificar límite
      const result = await this.checkLimit(identifier, config);

      // Agregar headers de rate limit a la respuesta
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(Date.now() + result.resetTime * 1000).toISOString());

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Too Many Requests',
          message: 'Has excedido el límite de solicitudes. Por favor, intenta más tarde.',
          retryAfter: result.resetTime,
        });
      }

      next();
    };
  }

  /**
   * Obtiene la configuración de rate limit
   */
  private getConfig(
    configOrKey: string | RateLimitConfig,
    customConfig?: RateLimitConfig
  ): RateLimitConfig {
    if (typeof configOrKey === 'string') {
      return customConfig || DEFAULT_RATE_LIMITS[configOrKey] || DEFAULT_RATE_LIMITS.public;
    }

    return configOrKey;
  }

  /**
   * Obtiene el identificador según el tipo de límite
   */
  private getIdentifier(req: any, config: RateLimitConfig): string {
    switch (config.type) {
      case 'tenant':
        return req.tenantId || 'unknown';
      case 'user':
        return req.userId || 'unknown';
      case 'ip':
        return req.ip || req.connection.remoteAddress || 'unknown';
      case 'global':
        return 'global';
      case 'custom':
        return req.body?.identifier || 'unknown';
      default:
        return req.tenantId || 'unknown';
    }
  }

  /**
   * Genera la key de ventana basada en el timestamp actual
   */
  private getWindowKey(window: number): string {
    const now = Math.floor(Date.now() / 1000);
    const windowStart = Math.floor(now / window) * window;
    return windowStart.toString();
  }

  /**
   * Obtiene estadísticas de uso de rate limits
   */
  async getStats(): Promise<{
    totalLimits: number;
    activeLimits: number;
    topConsumers: Array<{ identifier: string; count: number }>;
  }> {
    const keys = await this.cache.keys('ratelimit:*');

    const consumers = await Promise.all(
      keys.map(async (key) => {
        const countStr = await this.cache.getRaw(key);
        const count = countStr ? parseInt(countStr, 10) : 0;
        const identifier = key.split(':')[1];
        return { identifier, count };
      })
    );

    const sortedConsumers = consumers
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalLimits: DEFAULT_RATE_LIMITS.length,
      activeLimits: keys.length,
      topConsumers: sortedConsumers,
    };
  }

  /**
   * Limpia todos los contadores de rate limit
   */
  async clearAll(): Promise<number> {
    return await this.cache.deletePattern('ratelimit:*');
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const rateLimitService = new RateLimitService();
