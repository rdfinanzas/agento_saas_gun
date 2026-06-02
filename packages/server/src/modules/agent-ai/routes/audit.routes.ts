/**
 * Audit Routes - SP-9: Logs y Auditoría API
 *
 * Endpoints para consultar logs de auditoría y ejecuciones de herramientas
 */

import { Hono } from "hono"
import { z } from "zod"
import { auditService } from "../services/audit.service"
import type { AuditAction, AuditResourceType, ToolExecutionStatus } from "@/db/schema"

export const auditRoutes = new Hono()

// ============================================
// GET /api/v1/audit/logs - Lista logs de auditoría
// ============================================
auditRoutes.get("/logs", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const limit = c.req.query("limit")
    const offset = c.req.query("offset")
    const action = c.req.query("action") as AuditAction | undefined
    const resourceType = c.req.query("resourceType") as AuditResourceType | undefined
    const resourceId = c.req.query("resourceId")
    const userId = c.req.query("userId")

    const result = await auditService.getAuditLogs(tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      action,
      resourceType,
      resourceId,
      userId,
    })

    return c.json(result)
  } catch (error) {
    console.error("Error fetching audit logs:", error)
    return c.json({ error: "Failed to fetch audit logs" }, 500)
  }
})

// ============================================
// GET /api/v1/audit/logs/stats - Estadísticas de auditoría
// ============================================
auditRoutes.get("/logs/stats", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    // Obtener conteos por acción
    const logs = await auditService.getAuditLogs(tenantId, { limit: 10000 })

    const stats = {
      total: logs.total,
      byAction: {} as Record<string, number>,
      byResourceType: {} as Record<string, number>,
      recentActivity: logs.logs.slice(0, 10),
    }

    for (const log of logs.logs) {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1
      if (log.resourceType) {
        stats.byResourceType[log.resourceType] =
          (stats.byResourceType[log.resourceType] || 0) + 1
      }
    }

    return c.json(stats)
  } catch (error) {
    console.error("Error fetching audit stats:", error)
    return c.json({ error: "Failed to fetch audit stats" }, 500)
  }
})

// ============================================
// GET /api/v1/audit/tools - Lista ejecuciones de herramientas
// ============================================
auditRoutes.get("/tools", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const limit = c.req.query("limit")
    const offset = c.req.query("offset")
    const sessionId = c.req.query("sessionId")
    const toolName = c.req.query("toolName")
    const status = c.req.query("status") as ToolExecutionStatus | undefined

    const result = await auditService.getToolExecutions(tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      sessionId,
      toolName,
      status,
    })

    return c.json(result)
  } catch (error) {
    console.error("Error fetching tool executions:", error)
    return c.json({ error: "Failed to fetch tool executions" }, 500)
  }
})

// ============================================
// GET /api/v1/audit/tools/stats - Estadísticas de herramientas
// ============================================
auditRoutes.get("/tools/stats", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const stats = await auditService.getToolStats(tenantId)

    return c.json({ stats })
  } catch (error) {
    console.error("Error fetching tool stats:", error)
    return c.json({ error: "Failed to fetch tool stats" }, 500)
  }
})

// ============================================
// GET /api/v1/audit/tools/:id - Obtiene una ejecución específica
// ============================================
auditRoutes.get("/tools/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  try {
    const result = await auditService.getToolExecutions(tenantId)

    const execution = result.executions.find((e) => e.id === id)

    if (!execution) {
      return c.json({ error: "Tool execution not found" }, 404)
    }

    return c.json({ execution })
  } catch (error) {
    console.error("Error fetching tool execution:", error)
    return c.json({ error: "Failed to fetch tool execution" }, 500)
  }
})

// ============================================
// POST /api/v1/audit/logs - Crea un log de auditoría manual
// ============================================
const createLogSchema = z.object({
  action: z.string(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  success: z.enum(["yes", "no", "partial"]).optional(),
  errorMessage: z.string().optional(),
})

auditRoutes.post("/logs", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown"
  const userAgent = c.req.header("user-agent")

  try {
    const body = await c.req.json()
    const validated = createLogSchema.parse(body)

    await auditService.log({
      tenantId,
      action: validated.action as AuditAction,
      resourceType: validated.resourceType as AuditResourceType,
      resourceId: validated.resourceId,
      details: validated.details,
      success: validated.success,
      errorMessage: validated.errorMessage,
      userId,
      ipAddress,
      userAgent,
      requestId: c.get("requestId"),
    })

    return c.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400)
    }
    console.error("Error creating audit log:", error)
    return c.json({ error: "Failed to create audit log" }, 500)
  }
})
