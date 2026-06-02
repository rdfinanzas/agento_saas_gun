/**
 * Analytics Controller
 * Migrado de Express a Hono
 */

import type { Context } from "hono"
import { analyticsService } from "../services/analytics.service"
import { HTTPException } from "hono/http-exception"

export class AnalyticsController {
  /**
   * GET /api/v1/analytics/dashboard
   * Obtiene estadísticas generales del dashboard
   */
  async getDashboardStats(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const stats = await analyticsService.getDashboardStats(tenantId)

    return c.json({
      success: true,
      data: stats,
    })
  }

  /**
   * GET /api/v1/analytics/conversations
   * Métricas de conversaciones por período
   */
  async getConversationMetrics(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const period = (c.req.query("period") as "day" | "week" | "month") || "day"
    const days = parseInt(c.req.query("days") || 30)

    const metrics = await analyticsService.getConversationMetrics(
      tenantId,
      period,
      days
    )

    return c.json({
      success: true,
      data: metrics,
    })
  }

  /**
   * GET /api/v1/analytics/usage
   * Estadísticas de uso desde TenantUsage
   */
  async getUsageStats(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const days = parseInt(c.req.query("days") || 30)

    const stats = await analyticsService.getUsageStats(tenantId, days)

    return c.json({
      success: true,
      data: stats,
    })
  }

  /**
   * GET /api/v1/analytics/agents/performance
   * Performance por agente (WhatsAppConfig)
   */
  async getAgentPerformance(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const days = parseInt(c.req.query("days") || 30)

    const performance = await analyticsService.getAgentPerformance(tenantId, days)

    return c.json({
      success: true,
      data: performance,
    })
  }

  /**
   * GET /api/v1/analytics/queries/top
   * Top queries extraídas del historial
   */
  async getTopQueries(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const limit = parseInt(c.req.query("limit") || 10)
    const days = parseInt(c.req.query("days") || 30)

    const topQueries = await analyticsService.getTopQueries(tenantId, limit, days)

    return c.json({
      success: true,
      data: topQueries,
    })
  }

  /**
   * GET /api/v1/analytics/response-time
   * Métricas de tiempo de respuesta
   */
  async getResponseTimeMetrics(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const days = parseInt(c.req.query("days") || 30)

    const metrics = await analyticsService.getResponseTimeMetrics(tenantId, days)

    return c.json({
      success: true,
      data: metrics,
    })
  }

  /**
   * GET /api/v1/analytics/complete
   * Métricas completas consolidadas (todas las anteriores en una sola llamada)
   */
  async getCompleteAnalytics(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const days = parseInt(c.req.query("days") || 30)

    const analytics = await analyticsService.getCompleteAnalytics(tenantId, days)

    return c.json({
      success: true,
      data: analytics,
    })
  }

  /**
   * GET /api/v1/analytics/kpis
   * Obtiene KPIs de negocio para el dashboard
   */
  async getKPIs(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const startDate = c.req.query("startDate")
      ? new Date(c.req.query("startDate"))
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    const endDate = c.req.query("endDate")
      ? new Date(c.req.query("endDate"))
      : new Date()

    const kpis = await analyticsService.getKPIs(tenantId, { startDate, endDate })

    return c.json({
      success: true,
      data: kpis,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
    })
  }

  /**
   * GET /api/v1/analytics/kpis/compare
   * Compara KPIs entre dos períodos
   */
  async compareKPIs(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const currentStartDate = c.req.query("currentStartDate")
      ? new Date(c.req.query("currentStartDate"))
      : new Date(Date.now() - 30 * 24 * 60 * 6 * 1000)

    const currentEndDate = c.req.query("currentEndDate")
      ? new Date(c.req.query("currentEndDate"))
      : new Date()

    const previousStartDate = c.req.query("previousStartDate")
      ? new Date(c.req.query("previousStartDate"))
      : new Date(
          currentStartDate.getTime() -
          (currentEndDate.getTime() - currentStartDate.getTime())
        )

    const previousEndDate = c.req.query("previousEndDate")
      ? new Date(c.req.query("previousEndDate"))
      : new Date()

    const comparison = await analyticsService.compareKPIs(
      tenantId,
      { startDate: currentStartDate, endDate: currentEndDate },
      { startDate: previousStartDate, endDate: previousEndDate }
    )

    return c.json({
      success: true,
      data: comparison,
    })
  }

  /**
   * GET /api/v1/analytics/kpis/trends
   * Obtiene tendencias de KPIs a lo largo del tiempo
   */
  async getKPITrends(c: Context) {
    const tenantId = c.get("tenantId") as string

    if (!tenantId) {
      throw new HTTPException(401, { message: "Unauthorized" })
    }

    const days = parseInt(c.req.query("days") || 30)

    if (days > 365) {
      throw new HTTPException(400, { message: "Rango de fechas muy amplio, El máximo es 365 días" })
    }

    const trends = await analyticsService.getKPITrends(tenantId, days)

    return c.json({
      success: true,
      data: trends,
      meta: {
        days,
        generatedAt: new Date().toISOString(),
      },
    })
  }
}

export const analyticsController = new AnalyticsController()
