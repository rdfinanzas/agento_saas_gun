/**
 * Approval Routes - SP-6: Approval Workflow API
 *
 * Endpoints para gestionar solicitudes de aprobación
 * para ejecución de herramientas.
 */

import { Hono } from "hono"
import { z } from "zod"
import { approvalService } from "../services/approval.service"
import { workspaceManager } from "../services/workspace.service"

export const approvalRoutes = new Hono()

// ============================================
// GET /api/v1/approvals/stats - Estadísticas de approvals
// ============================================
approvalRoutes.get("/stats", async (c) => {
  const tenantId = c.get("tenantId")

  try {
    const approvals = await approvalService.listPending(tenantId, {})

    return c.json({
      stats: {
        totalPending: approvals.length,
      },
    })
  } catch (error) {
    console.error("Error fetching approval stats:", error)
    return c.json({ stats: { totalPending: 0 } }, 500)
  }
})

// ============================================
// GET /api/v1/approvals - Lista approvals pendientes
// ============================================
approvalRoutes.get("/", async (c) => {
  const tenantId = c.get("tenantId")
  const status = c.req.query("status") || "pending"
  const limit = c.req.query("limit")
  const offset = c.req.query("offset")
  const sessionId = c.req.query("sessionId")

  if (status !== "pending" && status !== "approved" && status !== "rejected" && status !== "expired") {
    return c.json({ error: "Invalid status" }, 400)
  }

  try {
    const approvals = await approvalService.listPending(tenantId, {
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
      sessionId,
    })

    return c.json({
      approvals,
      count: approvals.length,
    })
  } catch (error) {
    console.error("Error fetching approvals:", error)
    return c.json({ error: "Failed to fetch approvals" }, 500)
  }
})

// ============================================
// GET /api/v1/approvals/:id - Obtiene un approval específico
// ============================================
approvalRoutes.get("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  try {
    const approval = await approvalService.getRequest(id, tenantId)

    if (!approval) {
      return c.json({ error: "Approval not found" }, 404)
    }

    return c.json({ approval })
  } catch (error) {
    console.error("Error fetching approval:", error)
    return c.json({ error: "Failed to fetch approval" }, 500)
  }
})

// ============================================
// POST /api/v1/approvals/:id/approve - Aprueba una solicitud
// ============================================
const approveSchema = z.object({
  notes: z.string().optional(),
})

approvalRoutes.post("/:id/approve", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")

  try {
    const body = await c.req.json()
    const validated = approveSchema.parse(body)

    const result = await approvalService.approve(id, tenantId, {
      approved: true,
      reviewedBy: userId || "system",
      notes: validated.notes,
    })

    return c.json(result)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400)
    }
    console.error("Error approving request:", error)
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to approve request" },
      500
    )
  }
})

// ============================================
// POST /api/v1/approvals/:id/reject - Rechaza una solicitud
// ============================================
const rejectSchema = z.object({
  notes: z.string().optional(),
})

approvalRoutes.post("/:id/reject", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")

  try {
    const body = await c.req.json()
    const validated = rejectSchema.parse(body)

    const approval = await approvalService.reject(id, tenantId, {
      approved: false,
      reviewedBy: userId || "system",
      notes: validated.notes,
    })

    return c.json({ approval })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400)
    }
    console.error("Error rejecting request:", error)
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to reject request" },
      500
    )
  }
})

// ============================================
// POST /api/v1/approvals/request - Crea una nueva solicitud
// ============================================
const requestApprovalSchema = z.object({
  sessionId: z.string(),
  toolName: z.string(),
  toolParams: z.any(),
})

approvalRoutes.post("/request", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")

  try {
    const body = await c.req.json()
    const validated = requestApprovalSchema.parse(body)

    const approval = await approvalService.createRequest({
      tenantId,
      sessionId: validated.sessionId,
      toolName: validated.toolName,
      toolParams: validated.toolParams,
      requestedBy: userId,
    })

    return c.json({ approval }, 201)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Invalid request body", details: error.errors }, 400)
    }
    console.error("Error creating approval request:", error)
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to create approval request" },
      500
    )
  }
})

// ============================================
// DELETE /api/v1/approvals/:id - Cancela una solicitud pendiente
// ============================================
approvalRoutes.delete("/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  try {
    const approval = await approvalService.getRequest(id, tenantId)

    if (!approval) {
      return c.json({ error: "Approval not found" }, 404)
    }

    if (approval.status !== "pending") {
      return c.json({ error: `Cannot cancel request with status: ${approval.status}` }, 400)
    }

    await approvalService.updateStatus(id, tenantId, "rejected")

    return c.json({ success: true })
  } catch (error) {
    console.error("Error cancelling approval:", error)
    return c.json({ error: "Failed to cancel approval" }, 500)
  }
})
