import { prisma } from '../../../config/database';
import { cacheService } from '../../cache/services/cache.service';

/**
 * Analytics Service - FASE 3.2 + FASE 6
 *
 * Proporciona métricas y estadísticas para el dashboard de analytics.
 * Utiliza los modelos Prisma existentes: Conversation, Message, TenantUsage, WhatsAppConfig
 *
 * Fase 6: Optimización - Métricas mejoradas con Redis cache
 */
export class AnalyticsService {
  /**
   * Obtiene estadísticas generales del dashboard
   * Totales de conversaciones, mensajes, agentes activos
   */
  async getDashboardStats(tenantId: string) {
    const [
      totalConversations,
      activeConversations,
      totalMessages,
      agentsCount,
      conversationsToday,
      messagesToday
    ] = await Promise.all([
      // Total de conversaciones históricas
      prisma.conversation.count({ where: { tenantId } }),

      // Conversaciones activas actualmente
      prisma.conversation.count({
        where: { tenantId, status: 'ACTIVE' }
      }),

      // Total de mensajes enviados
      prisma.message.count({ where: { tenantId } }),

      // Agentes de WhatsApp configurados y activos
      prisma.whatsAppConfig.count({
        where: { tenantId, isActive: true }
      }),

      // Conversaciones creadas hoy
      prisma.conversation.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      }),

      // Mensajes enviados hoy
      prisma.message.count({
        where: {
          tenantId,
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0))
          }
        }
      })
    ]);

    return {
      overview: {
        totalConversations,
        activeConversations,
        totalMessages,
        agentsCount,
        conversationsToday,
        messagesToday
      },
      calculated: {
        avgMessagesPerConversation: totalConversations > 0
          ? Math.round((totalMessages / totalConversations) * 10) / 10
          : 0,
        activeRate: totalConversations > 0
          ? Math.round((activeConversations / totalConversations) * 100)
          : 0
      }
    };
  }

  /**
   * Métricas de conversaciones por período
   * Agrupa conversaciones por día, semana o mes
   */
  async getConversationMetrics(
    tenantId: string,
    period: 'day' | 'week' | 'month' = 'day',
    days: number = 30
  ) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: since }
      },
      include: {
        messages: true,
        _count: {
          select: { messages: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Agrupar por período
    const groupedByPeriod = this.groupByPeriod(conversations, period);

    // Calcular métricas agregadas
    const totalConversations = conversations.length;
    const totalMessages = conversations.reduce((sum, c) => sum + c._count.messages, 0);
    const avgMessagesPerConversation = totalConversations > 0
      ? Math.round((totalMessages / totalConversations) * 10) / 10
      : 0;

    // Conversaciones por estado
    const byStatus = {
      active: conversations.filter(c => c.status === 'ACTIVE').length,
      closed: conversations.filter(c => c.status === 'CLOSED').length,
      humanTakeover: conversations.filter(c => c.status === 'HUMAN_TAKEOVER').length
    };

    return {
      period: `${days} días agrupados por ${period}`,
      summary: {
        totalConversations,
        totalMessages,
        avgMessagesPerConversation,
        byStatus
      },
      timeline: groupedByPeriod
    };
  }

  /**
   * Estadísticas de uso desde TenantUsage
   * Requests y mensajes de WhatsApp por día
   */
  async getUsageStats(tenantId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const usage = await prisma.tenantUsage.findMany({
      where: {
        tenantId,
        date: { gte: since }
      },
      orderBy: { date: 'asc' }
    });

    // Calcular totales
    const totals = {
      requests: usage.reduce((sum, u) => sum + u.requestsCount, 0),
      whatsappMessages: usage.reduce((sum, u) => sum + u.whatsappMessages, 0),
      avgRequestsPerDay: usage.length > 0
        ? Math.round(usage.reduce((sum, u) => sum + u.requestsCount, 0) / usage.length)
        : 0,
      avgMessagesPerDay: usage.length > 0
        ? Math.round(usage.reduce((sum, u) => sum + u.whatsappMessages, 0) / usage.length)
        : 0
    };

    // Encontrar pico de uso
    const peakDay = usage.reduce((max, u) =>
      u.requestsCount > max.requestsCount ? u : max, usage[0] || { requestsCount: 0, date: new Date() });

    // Tendencia (comparar últimos 7 días con 7 días anteriores)
    const last7Days = usage.slice(-7);
    const previous7Days = usage.slice(-14, -7);

    const trend = {
      requests: this.calculateTrend(
        last7Days.reduce((s, u) => s + u.requestsCount, 0),
        previous7Days.reduce((s, u) => s + u.requestsCount, 0)
      ),
      messages: this.calculateTrend(
        last7Days.reduce((s, u) => s + u.whatsappMessages, 0),
        previous7Days.reduce((s, u) => s + u.whatsappMessages, 0)
      )
    };

    return {
      period: `${days} días`,
      daily: usage.map(u => ({
        date: u.date.toISOString().split('T')[0],
        requests: u.requestsCount,
        messages: u.whatsappMessages
      })),
      totals,
      peakDay: {
        date: peakDay.date?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
        requests: peakDay.requestsCount
      },
      trend
    };
  }

  /**
   * Performance por agente (WhatsAppConfig)
   * Conversaciones y mensajes manejados por cada agente
   */
  async getAgentPerformance(tenantId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const configs = await prisma.whatsAppConfig.findMany({
      where: { tenantId },
      include: {
        conversations: {
          where: {
            createdAt: { gte: since }
          },
          include: {
            _count: {
              select: { messages: true }
            }
          }
        }
      }
    });

    const performance = configs.map(config => {
      const conversations = config.conversations;
      const totalMessages = conversations.reduce((sum, c) => sum + c._count.messages, 0);
      const activeConversations = conversations.filter(c => c.status === 'ACTIVE').length;

      return {
        agentId: config.id,
        agentMode: config.agentMode,
        isActive: config.isActive,
        phoneNumber: config.phoneNumber,
        stats: {
          totalConversations: conversations.length,
          activeConversations,
          totalMessages,
          avgMessagesPerConversation: conversations.length > 0
            ? Math.round((totalMessages / conversations.length) * 10) / 10
            : 0
        },
        // Conversaciones por estado
        byStatus: {
          active: conversations.filter(c => c.status === 'ACTIVE').length,
          closed: conversations.filter(c => c.status === 'CLOSED').length,
          humanTakeover: conversations.filter(c => c.status === 'HUMAN_TAKEOVER').length
        }
      };
    });

    // Ordenar por rendimiento (total de mensajes)
    performance.sort((a, b) => b.stats.totalMessages - a.stats.totalMessages);

    return {
      period: `${days} días`,
      agents: performance,
      summary: {
        totalAgents: performance.length,
        activeAgents: performance.filter((a: any) => a.isActive).length,
        totalConversations: performance.reduce((s: number, a: any) => s + a.stats.totalConversations, 0),
        totalMessages: performance.reduce((s: number, a: any) => s + a.stats.totalMessages, 0)
      }
    };
  }

  /**
   * Top queries extraídas del historial de mensajes
   * Analiza los mensajes entrantes más frecuentes
   */
  async getTopQueries(tenantId: string, limit: number = 10, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const messages = await prisma.message.findMany({
      where: {
        tenantId,
        direction: 'INCOMING',
        createdAt: { gte: since },
        type: 'text',
        content: { not: null }
      },
      select: {
        content: true,
        conversation: {
          select: {
            phoneNumber: true,
            contactName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Extraer palabras clave y frases comunes
    const queryMap = new Map<string, number>();

    messages.forEach((msg: any) => {
      if (msg.content) {
        const text = msg.content.toLowerCase().trim();

        // Contar mensajes exactos
        queryMap.set(text, (queryMap.get(text) || 0) + 1);

        // Extraer palabras clave individuales (mínimo 3 caracteres)
        const words = text.split(/\s+/)
          .filter((w: string) => w.length >= 3)
          .filter((w: string) => !['que', 'para', 'por', 'con', 'una', 'este', 'esta', 'como', 'donde', 'cuando', 'porque'].includes(w));

        words.forEach((word: string) => {
          queryMap.set(word, (queryMap.get(word) || 0) + 1);
        });
      }
    });

    // Convertir a array y ordenar por frecuencia
    const topQueries = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    // Categorizar queries comunes
    const categories = {
      greeting: topQueries.filter(q =>
        /^(hola|buenos|buenas|hey|saludos)/i.test(q.query)
      ),
      pricing: topQueries.filter(q =>
        /(precio|costo|cuánto|vale|tarifa)/i.test(q.query)
      ),
      support: topQueries.filter(q =>
        /(ayuda|problema|error|soporte|funciona)/i.test(q.query)
      ),
      product: topQueries.filter(q =>
        /(producto|catálogo|stock|disponible)/i.test(q.query)
      )
    };

    return {
      period: `${days} días`,
      totalQueries: messages.length,
      topQueries,
      categories: {
        greeting: categories.greeting.length,
        pricing: categories.pricing.length,
        support: categories.support.length,
        product: categories.product.length
      },
      // Ejemplos de mensajes recientes
      recentMessages: messages.slice(0, 5).map((m: any) => ({
        content: m.content,
        contact: m.conversation.contactName || m.conversation.phoneNumber
      }))
    };
  }

  /**
   * Métricas completas consolidadas
   * Combina todas las métricas en una sola respuesta
   */
  async getCompleteAnalytics(tenantId: string, days: number = 30) {
    const [dashboard, conversations, usage, agentPerformance, topQueries] = await Promise.all([
      this.getDashboardStats(tenantId),
      this.getConversationMetrics(tenantId, 'day', days),
      this.getUsageStats(tenantId, days),
      this.getAgentPerformance(tenantId, days),
      this.getTopQueries(tenantId, 10, days)
    ]);

    return {
      generatedAt: new Date().toISOString(),
      period: { days },
      dashboard,
      conversations,
      usage,
      agentPerformance,
      topQueries
    };
  }

  /**
   * Métricas de tiempo de respuesta
   * Calcula el tiempo promedio de respuesta
   */
  async getResponseTimeMetrics(tenantId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        createdAt: { gte: since }
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    const responseTimes: number[] = [];

    conversations.forEach((conv: any) => {
      for (let i = 0; i < conv.messages.length - 1; i++) {
        const current = conv.messages[i];
        const next = conv.messages[i + 1];

        // Si el mensaje actual es entrante y el siguiente es saliente
        if (current.direction === 'INCOMING' && next.direction === 'OUTGOING') {
          const diff = next.createdAt.getTime() - current.createdAt.getTime();
          responseTimes.push(diff);
        }
      }
    });

    const avgResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
      : 0;

    const minResponseTime = responseTimes.length > 0
      ? Math.min(...responseTimes)
      : 0;

    const maxResponseTime = responseTimes.length > 0
      ? Math.max(...responseTimes)
      : 0;

    return {
      period: `${days} días`,
      avgResponseTime: {
        ms: Math.round(avgResponseTime),
        seconds: Math.round(avgResponseTime / 1000),
        minutes: Math.round(avgResponseTime / 60000)
      },
      minResponseTime: {
        ms: Math.round(minResponseTime),
        seconds: Math.round(minResponseTime / 1000)
      },
      maxResponseTime: {
        ms: Math.round(maxResponseTime),
        seconds: Math.round(maxResponseTime / 1000),
        minutes: Math.round(maxResponseTime / 60000)
      },
      totalResponses: responseTimes.length
    };
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Agrupa conversaciones por período (day, week, month)
   */
  private groupByPeriod(conversations: any[], period: 'day' | 'week' | 'month') {
    const grouped = new Map<string, any>();

    conversations.forEach(conv => {
      const date = new Date(conv.createdAt);
      let key: string;

      if (period === 'day') {
        key = date.toISOString().split('T')[0]; // YYYY-MM-DD
      } else if (period === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          conversations: 0,
          messages: 0,
          byStatus: { active: 0, closed: 0, humanTakeover: 0 }
        });
      }

      const group = grouped.get(key)!;
      group.conversations++;
      group.messages += conv._count.messages;
      group.byStatus[conv.status.toLowerCase() as keyof typeof group.byStatus]++;
    });

    return Array.from(grouped.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );
  }

  /**
   * Calcula el porcentaje de tendencia entre dos períodos
   */
  private calculateTrend(current: number, previous: number): {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    percentage: number;
  } {
    if (previous === 0) {
      return {
        value: current,
        direction: current > 0 ? 'up' : 'neutral',
        percentage: 100
      };
    }

    const percentage = Math.round(((current - previous) / previous) * 100);

    return {
      value: current - previous,
      direction: percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'neutral',
      percentage: Math.abs(percentage)
    };
  }

  // ============================================================
  // FASE 6: Nuevas funcionalidades con Redis Cache
  // ============================================================

  /**
   * Obtiene métricas de un agente específico (V2)
   * Con caché Redis para mejor performance
   */
  async getAgentMetricsV2(tenantId: string, agentId: string, days: number = 30) {
    const cacheKey = `agent_metrics:${tenantId}:${agentId}:${days}`;

    // Intentar obtener del caché
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [agent, conversations, messages] = await Promise.all([
      prisma.agent.findFirst({
        where: { id: agentId, tenantId },
      }),
      prisma.conversation.findMany({
        where: { agentId, tenantId, createdAt: { gte: startDate } },
        include: { messages: true },
      }),
      prisma.message.findMany({
        where: {
          conversation: { agentId, tenantId },
          createdAt: { gte: startDate },
        },
      }),
    ]);

    if (!agent) {
      throw new Error('Agent not found');
    }

    // Calcular métricas avanzadas
    const metrics = {
      agentId: agent.id,
      agentName: agent.name,
      agentType: agent.type,
      totalConversations: conversations.length,
      totalMessages: messages.length,
      avgResponseTime: this.calculateAvgResponseTime(conversations),
      avgSessionDuration: this.calculateAvgSessionDuration(conversations),
      successRate: this.calculateSuccessRate(conversations),
      dailyUsage: this.groupByDay(conversations),
      topQueries: await this.getTopQueriesForAgent(agentId, days),
    };

    // Guardar en caché por 5 minutos
    await cacheService.set(cacheKey, metrics, { ttl: 300 });

    return metrics;
  }

  /**
   * Obtiene métricas globales del sistema (Admin)
   */
  async getGlobalMetrics(days: number = 30) {
    const cacheKey = `global_metrics:${days}`;

    // Intentar obtener del caché
    const cached = await cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [totalTenants, totalAgents, activeAgents, totalConversations, totalMessages] = await Promise.all([
      prisma.tenant.count(),
      prisma.agent.count(),
      prisma.agent.count({ where: { status: 'ACTIVE' } }),
      prisma.conversation.count({ where: { createdAt: { gte: startDate } } }),
      prisma.message.count({ where: { createdAt: { gte: startDate } } }),
    ]);

    const topTenants = await prisma.$queryRaw`
      SELECT t.id, t.name, COUNT(DISTINCT c.id) as conversations
      FROM tenants t
      LEFT JOIN conversations c ON c."tenantId" = t.id AND c."createdAt" >= ${startDate}
      GROUP BY t.id, t.name
      ORDER BY conversations DESC
      LIMIT 10
    `;

    const metrics = {
      period: { days, start: startDate, end: new Date() },
      summary: { totalTenants, totalAgents, activeAgents, totalConversations, totalMessages },
      topTenants,
      systemHealth: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cacheHitRate: (await cacheService.getStats()).hitRate,
      },
    };

    // Guardar en caché por 10 minutos
    await cacheService.set(cacheKey, metrics, { ttl: 600 });

    return metrics;
  }

  /**
   * Obtiene métricas en tiempo real
   */
  async getRealtimeMetrics() {
    const [activeConversations, activeAgents, messagesLastMinute, cacheStats] = await Promise.all([
      prisma.conversation.count({ where: { status: 'ACTIVE' } }),
      prisma.agent.count({ where: { status: 'ACTIVE' } }),
      prisma.message.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 60000) },
        },
      }),
      cacheService.getStats(),
    ]);

    return {
      timestamp: new Date(),
      activeConversations,
      activeAgents,
      messagesPerMinute: messagesLastMinute,
      cache: {
        totalKeys: cacheStats.totalKeys,
        hitRate: cacheStats.hitRate,
        memoryUsage: cacheStats.memoryUsage,
      },
      system: {
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      },
    };
  }

  /**
   * Registra una métrica personalizada
   */
  async recordMetric(tenantId: string, type: string, value: number, metadata?: any) {
    const date = new Date().toISOString().split('T')[0];
    const key = `metric:${tenantId}:${type}:${date}`;

    const current = await cacheService.get(key);
    const updated = current
      ? { ...current, value: current.value + value, count: current.count + 1, updatedAt: new Date() }
      : { value, count: 1, tenantId, type, date, metadata, createdAt: new Date(), updatedAt: new Date() };

    await cacheService.set(key, updated, { ttl: 86400 * 7 }); // 7 días

    return updated;
  }

  // ============================================================
  // PRIVATE METHODS - FASE 6
  // ============================================================

  private calculateAvgResponseTime(conversations: any[]): number {
    const responseTimes: number[] = [];

    for (const conv of conversations) {
      if (!conv.messages || conv.messages.length < 2) continue;

      for (let i = 0; i < conv.messages.length - 1; i++) {
        const current = conv.messages[i];
        const next = conv.messages[i + 1];

        if (current.direction === 'INCOMING' && next.direction === 'OUTGOING') {
          responseTimes.push(next.createdAt.getTime() - current.createdAt.getTime());
        }
      }
    }

    return responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0;
  }

  private calculateAvgSessionDuration(conversations: any[]): number {
    const durations = conversations
      .filter((c: any) => c.createdAt && c.lastMessageAt)
      .map((c: any) => c.lastMessageAt.getTime() - c.createdAt.getTime());

    return durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;
  }

  private calculateSuccessRate(conversations: any[]): number {
    if (conversations.length === 0) return 0;

    const successful = conversations.filter(
      (c: any) => c.status === 'RESOLVED' || c.status === 'CLOSED'
    ).length;

    return successful / conversations.length;
  }

  private groupByDay(conversations: any[]): Array<{ date: string; conversations: number; messages: number }> {
    const grouped = new Map<string, { conversations: number; messages: number }>();

    for (const conv of conversations) {
      const date = conv.createdAt.toISOString().split('T')[0];

      if (!grouped.has(date)) {
        grouped.set(date, { conversations: 0, messages: 0 });
      }

      const data = grouped.get(date)!;
      data.conversations++;
      data.messages += conv.messages?.length || 0;
    }

    return Array.from(grouped.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  private async getTopQueriesForAgent(agentId: string, days: number): Promise<Array<{ query: string; count: number }>> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const messages = await prisma.message.findMany({
      where: {
        conversation: { agentId },
        direction: 'INCOMING',
        createdAt: { gte: since },
        type: 'TEXT',
        content: { not: null },
      },
      select: { content: true },
    });

    const queryMap = new Map<string, number>();

    for (const msg of messages) {
      if (msg.content) {
        const text = msg.content.toLowerCase().trim();
        queryMap.set(text, (queryMap.get(text) || 0) + 1);
      }
    }

    return Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
}
