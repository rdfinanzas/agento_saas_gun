/**
 * Analytics Service - Métricas y estadísticas
 * Migrado de Prisma a Drizzle ORM para Bun
 */

import { eq, and, gte, lte, sql, desc } from "drizzle-orm"
import { db } from "../../../db"
import { conversations, messages, whatsappConfigs, tenantUsages, agents, tenants } from "../../../db/schema"

export interface DashboardStats {
  overview: {
    totalConversations: number
    activeConversations: number
    totalMessages: number
    agentsCount: number
    conversationsToday: number
    messagesToday: number
  }
  calculated: {
    avgMessagesPerConversation: number
    activeRate: number
  }
}

export interface ConversationMetrics {
  period: string
  summary: {
    totalConversations: number
    totalMessages: number
    avgMessagesPerConversation: number
    byStatus: { active: number; closed: number; humanTakeover: number }
  }
  timeline: Array<{
    date: string
    conversations: number
    messages: number
    byStatus: { active: number; closed: number; humanTakeover: number }
  }>
}

export interface UsageStats {
  period: string
  daily: Array<{ date: string; requests: number; messages: number }>
  totals: {
    requests: number
    whatsappMessages: number
    avgRequestsPerDay: number
    avgMessagesPerDay: number
  }
  peakDay: { date: string; requests: number }
  trend: {
    requests: { value: number; direction: string; percentage: number }
    messages: { value: number; direction: string; percentage: number }
  }
}

export interface AgentPerformance {
  period: string
  agents: Array<{
    agentId: string
    agentMode: string | null
    isActive: boolean
    phoneNumber: string | null
    stats: {
      totalConversations: number
      activeConversations: number
      totalMessages: number
      avgMessagesPerConversation: number
    }
    byStatus: { active: number; closed: number; humanTakeover: number }
  }>
  summary: {
    totalAgents: number
    activeAgents: number
    totalConversations: number
    totalMessages: number
  }
}

export interface ResponseTimeMetrics {
  period: string
  avgResponseTime: { ms: number; seconds: number; minutes: number }
  minResponseTime: { ms: number; seconds: number }
  maxResponseTime: { ms: number; seconds: number; minutes: number }
  totalResponses: number
}

export interface KPISnapshot {
  totalConversations: number
  avgResponseTime: number
  satisfactionRate: number
  conversionRate: number
  issuesDetected: number
  issuesResolved: number
  humanTakeoverRate: number
  peakUsageHours: { hour: number; count: number }[]
  firstContactResolution: number
}

export interface KPIDateRange {
  startDate: Date
  endDate: Date
}

class AnalyticsService {
  /**
   * Obtiene estadísticas generales del dashboard
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const [
      totalConversations,
      activeConversations,
      totalMessages,
      agentsCount,
      conversationsToday,
      messagesToday,
    ] = await Promise.all([
      db.query.conversations.findMany({ where: eq(conversations.tenantId, tenantId) }),
      db.query.conversations.findMany({
        where: and(eq(conversations.tenantId, tenantId), eq(conversations.status, "ACTIVE")),
      }),
      db.query.messages.findMany({ where: eq(messages.tenantId, tenantId) }),
      db.query.whatsappConfigs.findMany({
        where: and(eq(whatsappConfigs.tenantId, tenantId), eq(whatsappConfigs.isActive, true)),
      }),
      db.query.conversations.findMany({
        where: and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, today)),
      }),
      db.query.messages.findMany({
        where: and(eq(messages.tenantId, tenantId), gte(messages.createdAt, today)),
      }),
    ])

    const totalConvCount = totalConversations.length
    const totalMsgCount = totalMessages.length

    return {
      overview: {
        totalConversations: totalConvCount,
        activeConversations: activeConversations.length,
        totalMessages: totalMsgCount,
        agentsCount: agentsCount.length,
        conversationsToday: conversationsToday.length,
        messagesToday: messagesToday.length,
      },
      calculated: {
        avgMessagesPerConversation:
          totalConvCount > 0 ? Math.round((totalMsgCount / totalConvCount) * 10) / 10 : 0,
        activeRate:
          totalConvCount > 0 ? Math.round((activeConversations.length / totalConvCount) * 100) : 0,
      },
    }
  }

  /**
   * Métricas de conversaciones por período
   */
  async getConversationMetrics(
    tenantId: string,
    period: "day" | "week" | "month" = "day",
    days: number = 30
  ): Promise<ConversationMetrics> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const allConversations = await db.query.conversations.findMany({
      where: and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, since)),
      orderBy: [desc(conversations.createdAt)],
    })

    // Get message counts for each conversation
    const conversationIds = allConversations.map((c) => c.id)
    const allMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.tenantId, tenantId),
        sql`${messages.conversationId} IN (${sql.raw(conversationIds.map((id) => `'${id}'`).join(","))})`
      ),
    })

    // Group messages by conversation
    const messageCounts = new Map<string, number>()
    for (const msg of allMessages) {
      const convId = msg.conversationId
      messageCounts.set(convId, (messageCounts.get(convId) || 0) + 1)
    }

    // Group by period
    const grouped = this.groupByPeriod(allConversations, messageCounts, period)

    const totalConversations = allConversations.length
    const totalMessages = Array.from(messageCounts.values()).reduce((a, b) => a + b, 0)

    const byStatus = {
      active: allConversations.filter((c) => c.status === "ACTIVE").length,
      closed: allConversations.filter((c) => c.status === "CLOSED").length,
      humanTakeover: allConversations.filter((c) => c.status === "HUMAN_TAKEOVER").length,
    }

    return {
      period: `${days} días agrupados por ${period}`,
      summary: {
        totalConversations,
        totalMessages,
        avgMessagesPerConversation:
          totalConversations > 0 ? Math.round((totalMessages / totalConversations) * 10) / 10 : 0,
        byStatus,
      },
      timeline: grouped,
    }
  }

  /**
   * Estadísticas de uso desde TenantUsage
   */
  async getUsageStats(tenantId: string, days: number = 30): Promise<UsageStats> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const usage = await db.query.tenantUsages.findMany({
      where: and(eq(tenantUsages.tenantId, tenantId), gte(tenantUsages.date, since)),
      orderBy: [desc(tenantUsages.date)],
    })

    const totals = {
      requests: usage.reduce((sum, u) => sum + (u.requestsCount || 0), 0),
      whatsappMessages: usage.reduce((sum, u) => sum + (u.whatsappMessages || 0), 0),
      avgRequestsPerDay:
        usage.length > 0
          ? Math.round(usage.reduce((sum, u) => sum + (u.requestsCount || 0), 0) / usage.length)
          : 0,
      avgMessagesPerDay:
        usage.length > 0
          ? Math.round(
              usage.reduce((sum, u) => sum + (u.whatsappMessages || 0), 0) / usage.length
            )
          : 0,
    }

    const peakDay = usage.reduce(
      (max, u) => ((u.requestsCount || 0) > (max.requestsCount || 0) ? u : max),
      usage[0] || { requestsCount: 0, date: new Date() }
    )

    const last7Days = usage.slice(-7)
    const previous7Days = usage.slice(-14, -7)

    const trend = {
      requests: this.calculateTrend(
        last7Days.reduce((s, u) => s + (u.requestsCount || 0), 0),
        previous7Days.reduce((s, u) => s + (u.requestsCount || 0), 0)
      ),
      messages: this.calculateTrend(
        last7Days.reduce((s, u) => s + (u.whatsappMessages || 0), 0),
        previous7Days.reduce((s, u) => s + (u.whatsappMessages || 0), 0)
      ),
    }

    return {
      period: `${days} días`,
      daily: usage.map((u) => ({
        date: u.date.toISOString().split("T")[0],
        requests: u.requestsCount || 0,
        messages: u.whatsappMessages || 0,
      })),
      totals,
      peakDay: {
        date: peakDay.date?.toISOString().split("T")[0] || new Date().toISOString().split("T")[0],
        requests: peakDay.requestsCount || 0,
      },
      trend,
    }
  }

  /**
   * Performance por agente (WhatsAppConfig)
   */
  async getAgentPerformance(tenantId: string, days: number = 30): Promise<AgentPerformance> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const configs = await db.query.whatsappConfigs.findMany({
      where: eq(whatsappConfigs.tenantId, tenantId),
    })

    const performance = await Promise.all(
      configs.map(async (config) => {
        const agentConversations = await db.query.conversations.findMany({
          where: and(
            eq(conversations.whatsappConfigId, config.id),
            gte(conversations.createdAt, since)
          ),
        })

        const convIds = agentConversations.map((c) => c.id)
        const agentMessages =
          convIds.length > 0
            ? await db.query.messages.findMany({
                where: sql`${messages.conversationId} IN (${sql.raw(
                  convIds.map((id) => `'${id}'`).join(",")
                )})`,
              })
            : []

        const totalMessages = agentMessages.length
        const activeConversations = agentConversations.filter(
          (c) => c.status === "ACTIVE"
        ).length

        return {
          agentId: config.id,
          agentMode: config.agentMode,
          isActive: config.isActive,
          phoneNumber: config.phoneNumber,
          stats: {
            totalConversations: agentConversations.length,
            activeConversations,
            totalMessages,
            avgMessagesPerConversation:
              agentConversations.length > 0
                ? Math.round((totalMessages / agentConversations.length) * 10) / 10
                : 0,
          },
          byStatus: {
            active: agentConversations.filter((c) => c.status === "ACTIVE").length,
            closed: agentConversations.filter((c) => c.status === "CLOSED").length,
            humanTakeover: agentConversations.filter((c) => c.status === "HUMAN_TAKEOVER").length,
          },
        }
      })
    )

    performance.sort((a, b) => b.stats.totalMessages - a.stats.totalMessages)

    return {
      period: `${days} días`,
      agents: performance,
      summary: {
        totalAgents: performance.length,
        activeAgents: performance.filter((a) => a.isActive).length,
        totalConversations: performance.reduce((s, a) => s + a.stats.totalConversations, 0),
        totalMessages: performance.reduce((s, a) => s + a.stats.totalMessages, 0),
      },
    }
  }

  /**
   * Top queries extraídas del historial de mensajes
   */
  async getTopQueries(
    tenantId: string,
    limit: number = 10,
    days: number = 30
  ): Promise<{
    period: string
    totalQueries: number
    topQueries: Array<{ query: string; count: number }>
    categories: { greeting: number; pricing: number; support: number; product: number }
    recentMessages: Array<{ content: string | null; contact: string }>
  }> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const incomingMessages = await db.query.messages.findMany({
      where: and(
        eq(messages.tenantId, tenantId),
        eq(messages.direction, "INCOMING"),
        gte(messages.createdAt, since),
        sql`${messages.type} = 'text'`
      ),
      orderBy: [desc(messages.createdAt)],
      limit: 1000,
    })

    const queryMap = new Map<string, number>()

    for (const msg of incomingMessages) {
      if (msg.content) {
        const text = msg.content.toLowerCase().trim()
        queryMap.set(text, (queryMap.get(text) || 0) + 1)

        const words = text
          .split(/\s+/)
          .filter((w) => w.length >= 3)
          .filter(
            (w) =>
              ![
                "que",
                "para",
                "por",
                "con",
                "una",
                "este",
                "esta",
                "como",
                "donde",
                "cuando",
                "porque",
              ].includes(w)
          )

        for (const word of words) {
          queryMap.set(word, (queryMap.get(word) || 0) + 1)
        }
      }
    }

    const topQueries = Array.from(queryMap.entries())
      .map(([query, count]) => ({ query, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)

    const categories = {
      greeting: topQueries.filter((q) => /^(hola|buenos|buenas|hey|saludos)/i.test(q.query)).length,
      pricing: topQueries.filter((q) => /(precio|costo|cuánto|vale|tarifa)/i.test(q.query)).length,
      support: topQueries.filter((q) => /(ayuda|problema|error|soporte|funciona)/i.test(q.query))
        .length,
      product: topQueries.filter((q) => /(producto|catálogo|stock|disponible)/i.test(q.query))
        .length,
    }

    return {
      period: `${days} días`,
      totalQueries: incomingMessages.length,
      topQueries,
      categories,
      recentMessages: incomingMessages.slice(0, 5).map((m) => ({
        content: m.content,
        contact: m.contactName || m.phoneNumber || "Unknown",
      })),
    }
  }

  /**
   * Métricas de tiempo de respuesta
   */
  async getResponseTimeMetrics(tenantId: string, days: number = 30): Promise<ResponseTimeMetrics> {
    const since = new Date()
    since.setDate(since.getDate() - days)

    const allConversations = await db.query.conversations.findMany({
      where: and(eq(conversations.tenantId, tenantId), gte(conversations.createdAt, since)),
    })

    const responseTimes: number[] = []

    for (const conv of allConversations) {
      const convMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conv.id),
        orderBy: [desc(messages.createdAt)],
      })

      for (let i = 0; i < convMessages.length - 1; i++) {
        const current = convMessages[i]
        const next = convMessages[i + 1]

        if (current.direction === "INCOMING" && next.direction === "OUTGOING") {
          const diff = next.createdAt.getTime() - current.createdAt.getTime()
          responseTimes.push(diff)
        }
      }
    }

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((s, t) => s + t, 0) / responseTimes.length
        : 0

    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0

    return {
      period: `${days} días`,
      avgResponseTime: {
        ms: Math.round(avgResponseTime),
        seconds: Math.round(avgResponseTime / 1000),
        minutes: Math.round(avgResponseTime / 60000),
      },
      minResponseTime: {
        ms: Math.round(minResponseTime),
        seconds: Math.round(minResponseTime / 1000),
      },
      maxResponseTime: {
        ms: Math.round(maxResponseTime),
        seconds: Math.round(maxResponseTime / 1000),
        minutes: Math.round(maxResponseTime / 60000),
      },
      totalResponses: responseTimes.length,
    }
  }

  /**
   * Métricas completas consolidadas
   */
  async getCompleteAnalytics(tenantId: string, days: number = 30) {
    const [dashboard, conversationMetrics, usage, agentPerformance, topQueries] = await Promise.all(
      [
        this.getDashboardStats(tenantId),
        this.getConversationMetrics(tenantId, "day", days),
        this.getUsageStats(tenantId, days),
        this.getAgentPerformance(tenantId, days),
        this.getTopQueries(tenantId, 10, days),
      ]
    )

    return {
      generatedAt: new Date().toISOString(),
      period: { days },
      dashboard,
      conversations: conversationMetrics,
      usage,
      agentPerformance,
      topQueries,
    }
  }

  /**
   * Obtiene KPIs de negocio
   */
  async getKPIs(tenantId: string, dateRange: KPIDateRange): Promise<KPISnapshot> {
    const { startDate, endDate } = dateRange

    const [
      totalConversations,
      avgResponseTime,
      satisfactionRate,
      conversionRate,
      issuesMetrics,
      humanTakeoverRate,
      peakUsageHours,
      firstContactResolution,
    ] = await Promise.all([
      this.getTotalConversations(tenantId, startDate, endDate),
      this.getAverageResponseTime(tenantId, startDate, endDate),
      this.getSatisfactionRate(tenantId, startDate, endDate),
      this.getConversionRate(tenantId, startDate, endDate),
      this.getIssuesMetrics(tenantId, startDate, endDate),
      this.getHumanTakeoverRate(tenantId, startDate, endDate),
      this.getPeakUsageHours(tenantId, startDate, endDate),
      this.getFirstContactResolution(tenantId, startDate, endDate),
    ])

    return {
      totalConversations,
      avgResponseTime,
      satisfactionRate,
      conversionRate,
      issuesDetected: issuesMetrics.detected,
      issuesResolved: issuesMetrics.resolved,
      humanTakeoverRate,
      peakUsageHours,
      firstContactResolution,
    }
  }

  /**
   * Compara KPIs entre dos períodos
   */
  async compareKPIs(
    tenantId: string,
    currentRange: KPIDateRange,
    previousRange: KPIDateRange
  ): Promise<{
    current: KPISnapshot
    previous: KPISnapshot
    changes: {
      totalConversations: { value: number; percentage: number }
      avgResponseTime: { value: number; percentage: number }
      satisfactionRate: { value: number; percentage: number }
      conversionRate: { value: number; percentage: number }
      humanTakeoverRate: { value: number; percentage: number }
    }
  }> {
    const [current, previous] = await Promise.all([
      this.getKPIs(tenantId, currentRange),
      this.getKPIs(tenantId, previousRange),
    ])

    const calculateChange = (currentVal: number, previousVal: number) => {
      const value = currentVal - previousVal
      const percentage =
        previousVal !== 0 ? ((currentVal - previousVal) / previousVal) * 100 : 0
      return { value, percentage: Math.round(percentage * 10) / 10 }
    }

    return {
      current,
      previous,
      changes: {
        totalConversations: calculateChange(
          current.totalConversations,
          previous.totalConversations
        ),
        avgResponseTime: calculateChange(current.avgResponseTime, previous.avgResponseTime),
        satisfactionRate: calculateChange(current.satisfactionRate, previous.satisfactionRate),
        conversionRate: calculateChange(current.conversionRate, previous.conversionRate),
        humanTakeoverRate: calculateChange(
          current.humanTakeoverRate,
          previous.humanTakeoverRate
        ),
      },
    }
  }

  /**
   * Obtiene tendencias de KPIs a lo largo del tiempo
   */
  async getKPITrends(
    tenantId: string,
    days: number = 30
  ): Promise<
    Array<{
      date: string
      totalConversations: number
      avgResponseTime: number
      humanTakeoverRate: number
    }>
  > {
    const trends: Array<{
      date: string
      totalConversations: number
      avgResponseTime: number
      humanTakeoverRate: number
    }> = []

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)

      const startDate = new Date(date)
      const endDate = new Date(date)
      endDate.setHours(23, 59, 59, 999)

      const [totalConversations, avgResponseTime, humanTakeoverRate] = await Promise.all([
        this.getTotalConversations(tenantId, startDate, endDate),
        this.getAverageResponseTime(tenantId, startDate, endDate),
        this.getHumanTakeoverRate(tenantId, startDate, endDate),
      ])

      trends.push({
        date: startDate.toISOString().split("T")[0],
        totalConversations,
        avgResponseTime,
        humanTakeoverRate,
      })
    }

    return trends
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  private groupByPeriod(
    conversationList: typeof conversations.$inferSelect[],
    messageCounts: Map<string, number>,
    period: "day" | "week" | "month"
  ) {
    const grouped = new Map<
      string,
      {
        date: string
        conversations: number
        messages: number
        byStatus: { active: number; closed: number; humanTakeover: number }
      }
    >()

    for (const conv of conversationList) {
      const date = new Date(conv.createdAt)
      let key: string

      if (period === "day") {
        key = date.toISOString().split("T")[0]
      } else if (period === "week") {
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split("T")[0]
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      }

      if (!grouped.has(key)) {
        grouped.set(key, {
          date: key,
          conversations: 0,
          messages: 0,
          byStatus: { active: 0, closed: 0, humanTakeover: 0 },
        })
      }

      const group = grouped.get(key)!
      group.conversations++
      group.messages += messageCounts.get(conv.id) || 0

      const statusKey = conv.status.toLowerCase() as keyof typeof group.byStatus
      if (statusKey in group.byStatus) {
        group.byStatus[statusKey]++
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date))
  }

  private calculateTrend(
    current: number,
    previous: number
  ): { value: number; direction: string; percentage: number } {
    if (previous === 0) {
      return {
        value: current,
        direction: current > 0 ? "up" : "neutral",
        percentage: 100,
      }
    }

    const percentage = Math.round(((current - previous) / previous) * 100)

    return {
      value: current - previous,
      direction: percentage > 0 ? "up" : percentage < 0 ? "down" : "neutral",
      percentage: Math.abs(percentage),
    }
  }

  private async getTotalConversations(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const result = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })
    return result.length
  }

  private async getAverageResponseTime(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const allConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const responseTimes: number[] = []

    for (const conv of allConversations) {
      const convMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conv.id),
        orderBy: [desc(messages.createdAt)],
      })

      for (let i = 0; i < convMessages.length - 1; i++) {
        const current = convMessages[i]
        const next = convMessages[i + 1]

        if (current.direction === "INCOMING" && next.direction === "OUTGOING") {
          const diff = next.createdAt.getTime() - current.createdAt.getTime()
          responseTimes.push(diff)
        }
      }
    }

    if (responseTimes.length === 0) return 0

    const avgMs = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
    return Math.round(avgMs / 1000)
  }

  private async getSatisfactionRate(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const closed = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "CLOSED"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const takeover = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "HUMAN_TAKEOVER"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const total = closed.length + takeover.length

    if (total === 0) return 85

    const satisfactionRate = (closed.length / total) * 100
    return Math.min(100, Math.max(70, Math.round(satisfactionRate)))
  }

  private async getConversionRate(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const total = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const closed = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "CLOSED"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    if (total.length === 0) return 0

    return Math.round((closed.length / total.length) * 100)
  }

  private async getIssuesMetrics(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ detected: number; resolved: number }> {
    const detected = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "HUMAN_TAKEOVER"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const resolved = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "CLOSED"),
        gte(conversations.updatedAt, startDate),
        lte(conversations.updatedAt, endDate)
      ),
    })

    return { detected: detected.length, resolved: resolved.length }
  }

  private async getHumanTakeoverRate(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const total = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const takeover = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "HUMAN_TAKEOVER"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    if (total.length === 0) return 0

    return Math.round((takeover.length / total.length) * 100)
  }

  private async getPeakUsageHours(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{ hour: number; count: number }[]> {
    const allConversations = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    const hourCounts = new Map<number, number>()

    for (const conv of allConversations) {
      const hour = new Date(conv.createdAt).getHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1)
    }

    return Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  private async getFirstContactResolution(
    tenantId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    const closed = await db.query.conversations.findMany({
      where: and(
        eq(conversations.tenantId, tenantId),
        eq(conversations.status, "CLOSED"),
        gte(conversations.createdAt, startDate),
        lte(conversations.createdAt, endDate)
      ),
    })

    if (closed.length === 0) return 0

    let firstContactResolutions = 0

    for (const conv of closed) {
      const convMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, conv.id),
      })
      if (convMessages.length <= 5) {
        firstContactResolutions++
      }
    }

    return Math.round((firstContactResolutions / closed.length) * 100)
  }
}

export const analyticsService = new AnalyticsService()
