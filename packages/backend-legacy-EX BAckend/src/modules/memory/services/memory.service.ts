import { prisma } from '../../../config/database';
import { ContextType } from '../../context/services/context-manager.service';

interface MemoryEntryValue {
  value: any;
  updatedAt: string;
  expiresAt?: string;
}

export class MemoryService {
  /**
   * Almacena un valor en la memoria persistente
   */
  async store(
    tenantId: string,
    key: string,
    value: any,
    contextType: ContextType = 'CHAT',
    ttlSeconds?: number,
    agentId?: string,
    category?: string
  ) {
    // Obtener o crear el contexto
    let context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) {
      context = await prisma.conversationContext.create({
        data: { tenantId, type: contextType }
      });
    }

    const ttl = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    // Upsert de la entrada de memoria
    return prisma.memoryEntry.upsert({
      where: {
        tenantId_contextId_key: {
          tenantId,
          contextId: context.id,
          key
        }
      },
      create: {
        tenantId,
        contextId: context.id,
        key,
        value,
        agentId,
        category,
        ttl
      },
      update: {
        value,
        ttl,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Recupera un valor de la memoria
   */
  async retrieve(
    tenantId: string,
    key: string,
    contextType: ContextType = 'CHAT'
  ): Promise<any | null> {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return null;

    const entry = await prisma.memoryEntry.findUnique({
      where: {
        tenantId_contextId_key: {
          tenantId,
          contextId: context.id,
          key
        }
      }
    });

    if (!entry) return null;

    // Verificar expiración
    if (entry.ttl && entry.ttl < new Date()) {
      await this.deleteKey(tenantId, key, contextType);
      return null;
    }

    return entry.value;
  }

  /**
   * Obtiene toda la memoria de un contexto
   */
  async getAllMemory(
    tenantId: string,
    contextType: ContextType = 'CHAT',
    category?: string
  ): Promise<Record<string, any>> {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return {};

    const where: any = { tenantId, contextId: context.id };
    if (category) where.category = category;

    const entries = await prisma.memoryEntry.findMany({ where });

    const result: Record<string, any> = {};
    const now = new Date();

    for (const entry of entries) {
      // Saltar entradas expiradas
      if (entry.ttl && entry.ttl < now) continue;
      result[entry.key] = entry.value;
    }

    return result;
  }

  /**
   * Elimina una clave de la memoria
   */
  async deleteKey(
    tenantId: string,
    key: string,
    contextType: ContextType = 'CHAT'
  ) {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return;

    return prisma.memoryEntry.deleteMany({
      where: { tenantId, contextId: context.id, key }
    });
  }

  /**
   * Limpia toda la memoria de un contexto
   */
  async clearMemory(
    tenantId: string,
    contextType: ContextType = 'CHAT'
  ) {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return;

    return prisma.memoryEntry.deleteMany({
      where: { tenantId, contextId: context.id }
    });
  }

  /**
   * Obtiene estadísticas de la memoria
   */
  async getMemoryStats(
    tenantId: string,
    contextType: ContextType = 'CHAT'
  ) {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return { totalKeys: 0, keys: [], byCategory: {} };

    const entries = await prisma.memoryEntry.findMany({
      where: { tenantId, contextId: context.id },
      select: { key: true, category: true, ttl: true }
    });

    const now = new Date();
    const validEntries = entries.filter(e => !e.ttl || e.ttl >= now);

    const byCategory: Record<string, number> = {};
    for (const entry of validEntries) {
      const cat = entry.category || 'default';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }

    return {
      totalKeys: validEntries.length,
      keys: validEntries.map(e => e.key),
      byCategory
    };
  }

  /**
   * Busca entradas por patrón de clave
   */
  async searchKeys(
    tenantId: string,
    pattern: string,
    contextType: ContextType = 'CHAT'
  ): Promise<string[]> {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return [];

    const entries = await prisma.memoryEntry.findMany({
      where: {
        tenantId,
        contextId: context.id,
        key: { contains: pattern }
      },
      select: { key: true, ttl: true }
    });

    const now = new Date();
    return entries
      .filter(e => !e.ttl || e.ttl >= now)
      .map(e => e.key);
  }

  /**
   * Busca entradas por categoría
   */
  async getByCategory(
    tenantId: string,
    category: string,
    contextType: ContextType = 'CHAT'
  ): Promise<Record<string, any>> {
    return this.getAllMemory(tenantId, contextType, category);
  }

  /**
   * Limpia entradas expiradas (mantenimiento)
   */
  async cleanupExpired(tenantId?: string): Promise<number> {
    const where: any = { ttl: { lt: new Date() } };
    if (tenantId) where.tenantId = tenantId;

    const result = await prisma.memoryEntry.deleteMany({ where });
    return result.count;
  }

  /**
   * Obtiene memoria por agente
   */
  async getByAgent(
    tenantId: string,
    agentId: string,
    contextType: ContextType = 'CHAT'
  ): Promise<Record<string, any>> {
    const context = await prisma.conversationContext.findFirst({
      where: { tenantId, type: contextType }
    });

    if (!context) return {};

    const entries = await prisma.memoryEntry.findMany({
      where: { tenantId, contextId: context.id, agentId }
    });

    const result: Record<string, any> = {};
    const now = new Date();

    for (const entry of entries) {
      if (entry.ttl && entry.ttl < now) continue;
      result[entry.key] = entry.value;
    }

    return result;
  }
}

export const memoryService = new MemoryService();
