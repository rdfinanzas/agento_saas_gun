/**
 * Usage Routes - SP-10: Monitoreo de Uso API
 *
 * Endpoints para consultar métricas de uso y cuotas
 */

import { Hono } from "hono"
import { z } from "zod"
import { usageService } from "../services/usage.service"
import type { MetricType, MetricPeriod } from "@/db/schema"

export const usageRoutes = new Hono()

// ============================================
// GET /api/v1/usage/summary - Resumen de uso
// ============================================
usageRoutes.get("/summary", async (c) => {
  const tenantId = c.get("tenantId")
  const period = (c.req.query("period") || "monthly") as MetricPeriod

  try {
    const summary = await usageService.getUsageSummary(tenantId, period)

    return c.json({
      summary,
      period,
    })
  } catch (error) {
    console.error("Error fetching usage summary:", error)
    return c.json({ error: "Failed to fetch usage summary" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/metrics - Métricas detalladas
// ============================================
usageRoutes.get("/metrics", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const metricType = c.req.query("metricType") as MetricType | undefined
    const period = c.req.query("period") as MetricPeriod | undefined
    const model = c.req.query("model")
    const agentId = c.req.query("agentId")
    const toolName = c.req.query("toolName")

    const metrics = await usageService.getMetrics(tenantId, {
      metricType,
      period,
      model,
      agentId,
      toolName,
    })

    return c.json({ metrics })
  } catch (error) {
    console.error("Error fetching usage metrics:", error)
    return c.json({ error: "Failed to fetch usage metrics" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/events - Eventos recientes
// ============================================
usageRoutes.get("/events", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const limit = c.req.query("limit")
    const eventType = c.req.query("eventType")
    const sessionId = c.req.query("sessionId")

    const events = await usageService.getRecentEvents(tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      eventType,
      sessionId,
    })

    return c.json({ events })
  } catch (error) {
    console.error("Error fetching usage events:", error)
    return c.json({ error: "Failed to fetch usage events" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/by-model - Uso por modelo de AI
// ============================================
usageRoutes.get("/by-model", async (c) => {
  const tenantId = c.get("tenantId")
  const period = (c.req.query("period") || "monthly") as MetricPeriod

  try {
    const byModel = await usageService.getUsageByModel(tenantId, period)

    return c.json({ byModel, period })
  } catch (error) {
    console.error("Error fetching usage by model:", error)
    return c.json({ error: "Failed to fetch usage by model" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/by-tool - Uso por herramienta
// ============================================
usageRoutes.get("/by-tool", async (c) => {
  const tenantId = c.get("tenantId")
  const period = (c.req.query("period") || "monthly") as MetricPeriod

  try {
    const byTool = await usageService.getUsageByTool(tenantId, period)

    return c.json({ byTool, period })
  } catch (error) {
    console.error("Error fetching usage by tool:", error)
    return c.json({ error: "Failed to fetch usage by tool" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/quotas - Lista cuotas del tenant
// ============================================
usageRoutes.get("/quotas", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    // Por ahora retornamos un array vacío
    // TODO: Implementar getQuotas en UsageService
    return c.json({ quotas: [] })
  } catch (error) {
    console.error("Error fetching quotas:", error)
    return c.json({ error: "Failed to fetch quotas" }, 500)
  }
})

// ============================================
// GET /api/v1/usage/quotas/:quotaType - Verifica cuota específica
// ============================================
usageRoutes.get("/quotas/:quotaType", async (c) => {
  const tenantId = c.get("tenantId")
  const quotaType = c.req.param("quotaType")

  try {
    const status = await usageService.checkQuota(tenantId, quotaType)

    return c.json(status)
  } catch (error) {
    console.error("Error checking quota:", error)
    return c.json({ error: "Failed to check quota" }, 500)
  }
})

// ============================================
// POST /api/v1/usage/quotas - Crea o actualiza cuota
// ============================================
const createQuotaSchema = z.object({
  quotaType: z.string(),
  limit: z.number().int().positive(),
  resetPeriod: z.enum(["daily", "weekly", "monthly"]),
})

usageRoutes.post("/quotas", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const body = await c.req.json()
    const validated = createQuotaSchema.parse(body)

    const quota = await usageService.setQuota({
      tenantId,
      quotaType: validated.quotaType,
      limit: validated.limit,
      resetPeriod: validated.resetPeriod,
    })

    return c.json({ quota }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400)
    }
    console.error("Error creating quota:", error)
    return c.json({ error: "Failed to create quota" }, 500)
  }
})

// ============================================
// DELETE /api/v1/usage/quotas/:quotaType - Elimina cuota
// ============================================
usageRoutes.delete("/quotas/:quotaType", async (c) => {
  const tenantId = c.get("tenantId")
  const quotaType = c.req.param("quotaType")

  try {
    // TODO: Implementar deleteQuota en UsageService
    return c.json({ success: true })
  } catch (error) {
    console.error("Error deleting quota:", error)
    return c.json({ error: "Failed to delete quota" }, 500)
  }
})
