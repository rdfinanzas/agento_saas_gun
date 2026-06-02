/**
 * Usage Service - SP-10: Monitoreo de Uso
 *
 * Servicio para tracking y monitoreo de métricas de uso:
 * tokens, requests, tool_executions, storage, etc.
 */

import { db } from "@/db"
import {
  usageMetrics,
  usageEvents,
  usageQuotas,
  type NewUsageMetric,
  type NewUsageEvent,
  type NewUsageQuota,
  type MetricType,
  type MetricPeriod,
} from "@/db/schema"
import { eq, and, desc, gte, lte, sql } from "drizzle-orm"
import { ulid } from "ulid"

export interface TrackUsageParams {
  tenantId: string
  metricType: MetricType
  value: number
  model?: string
  sessionId?: string
  agentId?: string
  toolName?: string
  metadata?: Record<string, any>
}

export interface UsageQuotaParams {
  tenantId: string
  quotaType: string
  limit: number
  resetPeriod: "daily" | "weekly" | "monthly"
}

/**
 * Servicio de monitoreo de uso
 */
export class UsageService {
  /**
   * Registra un evento de uso
   */
  async trackEvent(params: TrackUsageParams): Promise<void> {
    const event: NewUsageEvent = {
      id: ulid(),
      tenantId: params.tenantId,
      eventType: params.metricType,
      value: params.value,
      model: params.model,
      sessionId: params.sessionId,
      agentId: params.agentId,
      toolName: params.toolName,
      metadata: params.metadata || {},
    }

    await db.insert(usageEvents).values(event)

    // Actualizar métrica agregada correspondiente
    await this.updateMetric(params)
  }

  /**
   * Actualiza la métrica agregada (diaria, semanal, mensual)
   */
  private async updateMetric(params: TrackUsageParams): Promise<void> {
    const now = new Date()
    const periods: MetricPeriod[] = ["daily", "weekly", "monthly"]

    for (const period of periods) {
      const { start, end } = this.getPeriodRange(now, period)

      // Buscar métrica existente
      const existing = await db.query.usageMetrics.findFirst({
        where: and(
          eq(usageMetrics.tenantId, params.tenantId),
          eq(usageMetrics.metricType, params.metricType),
          eq(usageMetrics.period, period),
          gte(usageMetrics.periodStart, start),
          lte(usageMetrics.periodEnd, end),
          params.model ? eq(usageMetrics.model, params.model) : undefined,
          params.toolName ? eq(usageMetrics.toolName, params.toolName) : undefined,
        ),
      })

      if (existing) {
        // Actualizar existente
        await db
          .update(usageMetrics)
          .set({
            value: sql`${usageMetrics.value} + ${params.value}`,
            updatedAt: now,
          })
          .where(eq(usageMetrics.id, existing.id))
      } else {
        // Crear nueva
        const metric: NewUsageMetric = {
          tenantId: params.tenantId,
          metricType: params.metricType,
          value: params.value,
          model: params.model,
          sessionId: params.sessionId,
          agentId: params.agentId,
          toolName: params.toolName,
          metadata: params.metadata || {},
          period,
          periodStart: start,
          periodEnd: end,
        }

        await db.insert(usageMetrics).values(metric)
      }
    }
  }

  /**
   * Obtiene el rango de fechas para un período
   */
  private getPeriodRange(date: Date, period: MetricPeriod): { start: Date; end: Date } {
    const start = new Date(date)
    const end = new Date(date)

    switch (period) {
      case "daily":
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        break
      case "weekly":
        start.setDate(date.getDate() - date.getDay()) // Domingo
        start.setHours(0, 0, 0, 0)
        end.setDate(start.getDate() + 6) // Sábado
        end.setHours(23, 59, 59, 999)
        break
      case "monthly":
        start.setDate(1) // Primer día del mes
        start.setHours(0, 0, 0, 0)
        end.setMonth(start.getMonth() + 1) // Primer día del siguiente mes
        end.setDate(0) // Último día del mes actual
        end.setHours(23, 59, 59, 999)
        break
    }

    return { start, end }
  }

  /**
   * Obtiene métricas de uso de un tenant
   */
  async getMetrics(
    tenantId: string,
    options?: {
      metricType?: MetricType
      period?: MetricPeriod
      startDate?: Date
      endDate?: Date
      model?: string
      agentId?: string
      toolName?: string
    }
  ): Promise<typeof usageMetrics.$inferSelect[]> {
    const conditions = [eq(usageMetrics.tenantId, tenantId)]

    if (options?.metricType) {
      conditions.push(eq(usageMetrics.metricType, options.metricType))
    }

    if (options?.period) {
      conditions.push(eq(usageMetrics.period, options.period))
    }

    if (options?.model) {
      conditions.push(eq(usageMetrics.model, options.model))
    }

    if (options?.agentId) {
      conditions.push(eq(usageMetrics.agentId, options.agentId))
    }

    if (options?.toolName) {
      conditions.push(eq(usageMetrics.toolName, options.toolName))
    }

    // TODO: Agregar filtros de fecha

    return db.query.usageMetrics.findMany({
      where: and(...conditions),
      orderBy: [desc(usageMetrics.periodStart)],
      limit: 100,
    })
  }

  /**
   * Obtiene eventos de uso recientes
   */
  async getRecentEvents(
    tenantId: string,
    options?: {
      limit?: number
      eventType?: string
      sessionId?: string
    }
  ): Promise<typeof usageEvents.$inferSelect[]> {
    const conditions = [eq(usageEvents.tenantId, tenantId)]

    if (options?.eventType) {
      conditions.push(eq(usageEvents.eventType, options.eventType))
    }

    if (options?.sessionId) {
      conditions.push(eq(usageEvents.sessionId, options.sessionId))
    }

    return db.query.usageEvents.findMany({
      where: and(...conditions),
      orderBy: [desc(usageEvents.createdAt)],
      limit: options?.limit || 50,
    })
  }

  /**
   * Obtiene el resumen de uso de un tenant
   */
  async getUsageSummary(
    tenantId: string,
    period: MetricPeriod = "monthly"
  ): Promise<{
    tokens: number
    requests: number
    toolExecutions: number
    sessions: number
    messages: number
  }> {
    const { start, end } = this.getPeriodRange(new Date(), period)

    const metrics = await db.query.usageMetrics.findMany({
      where: and(
        eq(usageMetrics.tenantId, tenantId),
        eq(usageMetrics.period, period),
        gte(usageMetrics.periodStart, start),
        lte(usageMetrics.periodEnd, end)
      ),
    })

    const summary = {
      tokens: 0,
      requests: 0,
      toolExecutions: 0,
      sessions: 0,
      messages: 0,
    }

    for (const metric of metrics) {
      switch (metric.metricType) {
        case "tokens":
          summary.tokens += metric.value
          break
        case "requests":
          summary.requests += metric.value
          break
        case "tool_executions":
          summary.toolExecutions += metric.value
          break
        case "sessions":
          summary.sessions += metric.value
          break
        case "messages":
          summary.messages += metric.value
          break
      }
    }

    return summary
  }

  /**
   * Obtiene el uso por modelo de AI
   */
  async getUsageByModel(
    tenantId: string,
    period: MetricPeriod = "monthly"
  ): Promise<Array<{ model: string; tokens: number; requests: number }>> {
    const { start, end } = this.getPeriodRange(new Date(), period)

    const metrics = await db.query.usageMetrics.findMany({
      where: and(
        eq(usageMetrics.tenantId, tenantId),
        eq(usageMetrics.period, period),
        gte(usageMetrics.periodStart, start),
        lte(usageMetrics.periodEnd, end)
      ),
    })

    const byModel = new Map<string, { tokens: number; requests: number }>()

    for (const metric of metrics) {
      if (!metric.model) continue

      const existing = byModel.get(metric.model) || { tokens: 0, requests: 0 }

      if (metric.metricType === "tokens") {
        existing.tokens += metric.value
      } else if (metric.metricType === "requests") {
        existing.requests += metric.value
      }

      byModel.set(metric.model, existing)
    }

    return Array.from(byModel.entries()).map(([model, data]) => ({ model, ...data }))
  }

  /**
   * Obtiene el uso por herramienta
   */
  async getUsageByTool(
    tenantId: string,
    period: MetricPeriod = "monthly"
  ): Promise<Array<{ toolName: string; executions: number }>> {
    const { start, end } = this.getPeriodRange(new Date(), period)

    const metrics = await db.query.usageMetrics.findMany({
      where: and(
        eq(usageMetrics.tenantId, tenantId),
        eq(usageMetrics.period, period),
        eq(usageMetrics.metricType, "tool_executions"),
        gte(usageMetrics.periodStart, start),
        lte(usageMetrics.periodEnd, end)
      ),
    })

    const byTool = new Map<string, number>()

    for (const metric of metrics) {
      if (metric.toolName) {
        const existing = byTool.get(metric.toolName) || 0
        byTool.set(metric.toolName, existing + metric.value)
      }
    }

    return Array.from(byTool.entries()).map(([toolName, executions]) => ({
      toolName,
      executions,
    }))
  }

  /**
   * Crea o actualiza una cuota de uso
   */
  async setQuota(params: UsageQuotaParams): Promise<typeof usageQuotas.$inferSelect> {
    const now = new Date()
    const nextReset = this.calculateNextReset(now, params.resetPeriod)

    // Buscar cuota existente
    const existing = await db.query.usageQuotas.findFirst({
      where: and(
        eq(usageQuotas.tenantId, params.tenantId),
        eq(usageQuotas.quotaType, params.quotaType)
      ),
    })

    if (existing) {
      // Actualizar
      const [updated] = await db
        .update(usageQuotas)
        .set({
          limit: params.limit,
          nextResetAt: nextReset,
          updatedAt: now,
        })
        .where(eq(usageQuotas.id, existing.id))
        .returning()

      return updated
    } else {
      // Crear
      const quota: NewUsageQuota = {
        tenantId: params.tenantId,
        quotaType: params.quotaType,
        limit: params.limit,
        used: 0,
        resetPeriod: params.resetPeriod,
        lastResetAt: now,
        nextResetAt: nextReset,
      }

      const [created] = await db.insert(usageQuotas).values(quota).returning()
      return created
    }
  }

  /**
   * Calcula la próxima fecha de reset
   */
  private calculateNextReset(date: Date, period: string): Date {
    const next = new Date(date)

    switch (period) {
      case "daily":
        next.setDate(next.getDate() + 1)
        next.setHours(0, 0, 0, 0)
        break
      case "weekly":
        next.setDate(next.getDate() + 7)
        break
      case "monthly":
        next.setMonth(next.getMonth() + 1)
        next.setDate(1)
        next.setHours(0, 0, 0, 0)
        break
    }

    return next
  }

  /**
   * Verifica si un tenant ha excedido su cuota
   */
  async checkQuota(
    tenantId: string,
    quotaType: string
  ): Promise<{ allowed: boolean; used: number; limit: number; resetAt: Date }> {
    const quota = await db.query.usageQuotas.findFirst({
      where: and(
        eq(usageQuotas.tenantId, tenantId),
        eq(usageQuotas.quotaType, quotaType),
        eq(usageQuotas.isActive, true)
      ),
    })

    if (!quota) {
      // Sin cuota configurada, permitir
      return { allowed: true, used: 0, limit: -1, resetAt: new Date() }
    }

    // Verificar si necesita reset
    const now = new Date()
    if (now >= quota.nextResetAt) {
      // Resetear cuota
      await db
        .update(usageQuotas)
        .set({
          used: 0,
          lastResetAt: now,
          nextResetAt: this.calculateNextReset(now, quota.resetPeriod),
        })
        .where(eq(usageQuotas.id, quota.id))

      quota.used = 0
    }

    const allowed = quota.used < quota.limit

    return {
      allowed,
      used: quota.used,
      limit: quota.limit,
      resetAt: quota.nextResetAt,
    }
  }

  /**
   * Incrementa el uso de una cuota
   */
  async incrementQuota(
    tenantId: string,
    quotaType: string,
    amount: number = 1
  ): Promise<void> {
    const quota = await db.query.usageQuotas.findFirst({
      where: and(
        eq(usageQuotas.tenantId, tenantId),
        eq(usageQuotas.quotaType, quotaType)
      ),
    })

    if (!quota) return

    await db
      .update(usageQuotas)
      .set({
        used: sql`${usageQuotas.used} + ${amount}`,
      })
      .where(eq(usageQuotas.id, quota.id))
  }

  /**
   * Limpia eventos antiguos (retention policy)
   */
  async cleanOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // TODO: Implementar con SQL raw
    return 0
  }
}

export const usageService = new UsageService()

/**
 * Helper para tracking de tokens
 */
export async function trackTokens(
  tenantId: string,
  tokens: number,
  model: string,
  sessionId?: string
): Promise<void> {
  return usageService.trackEvent({
    tenantId,
    metricType: "tokens",
    value: tokens,
    model,
    sessionId,
  })
}

/**
 * Helper para tracking de requests
 */
export async function trackRequest(
  tenantId: string,
  model?: string,
  sessionId?: string,
  agentId?: string
): Promise<void> {
  return usageService.trackEvent({
    tenantId,
    metricType: "requests",
    value: 1,
    model,
    sessionId,
    agentId,
  })
}

/**
 * Helper para tracking de ejecuciones de herramientas
 */
export async function trackToolExecution(
  tenantId: string,
  toolName: string,
  sessionId?: string
): Promise<void> {
  return usageService.trackEvent({
    tenantId,
    metricType: "tool_executions",
    value: 1,
    sessionId,
    toolName,
  })
}
