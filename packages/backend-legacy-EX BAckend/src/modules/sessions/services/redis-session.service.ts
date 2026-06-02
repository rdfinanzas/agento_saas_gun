/**
 * Redis Session Service - Gestión de sesiones con Redis
 *
 * Implementa el almacenamiento y gestión de sesiones de agentes
 * usando Redis como backend para escalabilidad y TTL automático.
 *
 * Claves de sesión:
 * - Agentes internos: `session:{tenantId}:{agentId}:{userId}`
 * - Agentes externos (WhatsApp): `session:{tenantId}:{agentId}:{phoneNumber}`
 */

import Redis from 'ioredis';

// ============================================
// Interfaces
// ============================================

export interface SessionData {
  opencodeSessionId: string;
  tenantId: string;
  agentId: string;
  identifier: string; // userId (internos) o phoneNumber (externos)
  agentType: 'INTERNAL' | 'EXTERNAL';
  createdAt: number;
  lastActivity: number;
  metadata?: Record<string, any>;
}

export interface SessionOptions {
  ttl?: number; // Time to live en segundos (default: 30 minutos)
}

// ============================================
// Servicio Principal
// ============================================

export class RedisSessionService {
  private redis: Redis;
  private defaultTTL: number = 30 * 60; // 30 minutos

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('error', (err) => {
      console.error('[Redis] Error:', err);
    });

    this.redis.on('connect', () => {
      console.log('[Redis] Connected');
    });
  }

  /**
   * Genera la clave de sesión según el contexto
   */
  private getSessionKey(
    tenantId: string,
    agentId: string,
    identifier: string
  ): string {
    return `session:${tenantId}:${agentId}:${identifier}`;
  }

  /**
   * Crea o actualiza una sesión
   */
  async set(
    tenantId: string,
    agentId: string,
    identifier: string,
    opencodeSessionId: string,
    agentType: 'INTERNAL' | 'EXTERNAL',
    options?: SessionOptions
  ): Promise<void> {
    const key = this.getSessionKey(tenantId, agentId, identifier);
    const ttl = options?.ttl || this.defaultTTL;

    const sessionData: SessionData = {
      opencodeSessionId,
      tenantId,
      agentId,
      identifier,
      agentType,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Guardar en Redis con TTL
    await this.redis.setex(key, ttl, JSON.stringify(sessionData));
  }

  /**
   * Obtiene una sesión
   */
  async get(
    tenantId: string,
    agentId: string,
    identifier: string
  ): Promise<SessionData | null> {
    const key = this.getSessionKey(tenantId, agentId, identifier);
    const data = await this.redis.get(key);

    if (!data) {
      return null;
    }

    try {
      return JSON.parse(data) as SessionData;
    } catch (error) {
      console.error('[Redis] Error parsing session data:', error);
      return null;
    }
  }

  /**
   * Actualiza el tiempo de última actividad de una sesión
   * Renueva el TTL
   */
  async touch(
    tenantId: string,
    agentId: string,
    identifier: string
  ): Promise<void> {
    const key = this.getSessionKey(tenantId, agentId, identifier);
    const exists = await this.redis.exists(key);

    if (exists) {
      const ttl = await this.redis.ttl(key);
      const sessionData = await this.get(tenantId, agentId, identifier);

      if (sessionData) {
        sessionData.lastActivity = Date.now();
        await this.redis.setex(key, ttl, JSON.stringify(sessionData));
      }
    }
  }

  /**
   * Elimina una sesión
   */
  async delete(
    tenantId: string,
    agentId: string,
    identifier: string
  ): Promise<void> {
    const key = this.getSessionKey(tenantId, agentId, identifier);
    await this.redis.del(key);
  }

  /**
   * Verifica si existe una sesión
   */
  async exists(
    tenantId: string,
    agentId: string,
    identifier: string
  ): Promise<boolean> {
    const key = this.getSessionKey(tenantId, agentId, identifier);
    const result = await this.redis.exists(key);
    return result === 1;
  }

  /**
   * Obtiene todas las sesiones de un tenant
   */
  async getTenantSessions(tenantId: string): Promise<SessionData[]> {
    const pattern = `session:${tenantId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const sessions: SessionData[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          sessions.push(JSON.parse(data) as SessionData);
        } catch (error) {
          console.error('[Redis] Error parsing session data:', error);
        }
      }
    }

    return sessions;
  }

  /**
   * Obtiene todas las sesiones de un agente
   */
  async getAgentSessions(
    tenantId: string,
    agentId: string
  ): Promise<SessionData[]> {
    const pattern = `session:${tenantId}:${agentId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return [];
    }

    const sessions: SessionData[] = [];

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          sessions.push(JSON.parse(data) as SessionData);
        } catch (error) {
          console.error('[Redis] Error parsing session data:', error);
        }
      }
    }

    return sessions;
  }

  /**
   * Elimina todas las sesiones de un agente
   */
  async deleteAgentSessions(
    tenantId: string,
    agentId: string
  ): Promise<number> {
    const pattern = `session:${tenantId}:${agentId}:*`;
    const keys = await this.redis.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await this.redis.del(...keys);
    return keys.length;
  }

  /**
   * Limpia sesiones expiradas (opcional - Redis lo hace automáticamente con TTL)
   */
  async cleanExpiredSessions(): Promise<number> {
    // Redis maneja TTL automáticamente, pero podemos forzar limpieza
    // Esta función es más útil para debugging o estadísticas
    const pattern = 'session:*';
    const keys = await this.redis.keys(pattern);

    let cleaned = 0;

    for (const key of keys) {
      const ttl = await this.redis.ttl(key);
      if (ttl === -2) { // Key expirada
        await this.redis.del(key);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Obtiene estadísticas de sesiones
   */
  async getStats(tenantId?: string): Promise<{
    totalSessions: number;
    internalSessions: number;
    externalSessions: number;
    activeSessions: number;
  }> {
    const pattern = tenantId ? `session:${tenantId}:*` : 'session:*';
    const keys = await this.redis.keys(pattern);

    let internalSessions = 0;
    let externalSessions = 0;
    let activeSessions = 0;

    for (const key of keys) {
      const data = await this.redis.get(key);
      if (data) {
        try {
          const session = JSON.parse(data) as SessionData;

          if (session.agentType === 'INTERNAL') {
            internalSessions++;
          } else {
            externalSessions++;
          }

          // Considerar activa si tuvo actividad en los últimos 5 minutos
          const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
          if (session.lastActivity > fiveMinutesAgo) {
            activeSessions++;
          }
        } catch (error) {
          console.error('[Redis] Error parsing session data:', error);
        }
      }
    }

    return {
      totalSessions: keys.length,
      internalSessions,
      externalSessions,
      activeSessions,
    };
  }

  /**
   * Cierra la conexión con Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }

  /**
   * Verifica la conexión con Redis
   */
  async ping(): Promise<boolean> {
    try {
      const result = await this.redis.ping();
      return result === 'PONG';
    } catch (error) {
      console.error('[Redis] Ping error:', error);
      return false;
    }
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const redisSessionService = new RedisSessionService();
