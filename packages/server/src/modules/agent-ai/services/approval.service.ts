/**
 * Approval Service - SP-6: Approval Workflow
 *
 * Maneja el flujo de aprobación para ejecución de herramientas
 * que requieren permiso explícito del usuario.
 */

import { db } from "@/db"
import {
  approvalRequests,
  type ApprovalRequest,
  type NewApprovalRequest,
  type ApprovalStatus,
} from "@/db/schema/approval"
import { agentSessions } from "@/db/schema/agent-session"
import { eq, and, desc } from "drizzle-orm"
import { toolRegistry } from "@/lib/opencode/tools/registry"
import { executeTool } from "@/lib/opencode/tools"

export interface CreateApprovalParams {
  tenantId: string
  sessionId: string
  toolName: string
  toolParams: any
  requestedBy?: string
  /** Expiración en minutos (default: 60) */
  expiresIn?: number
}

export interface ApprovalDecision {
  approved: boolean
  reviewedBy: string
  notes?: string
}

/**
 * Servicio de aprobaciones
 */
export class ApprovalService {
  /**
   * Crea una nueva solicitud de aprobación
   */
  async createRequest(params: CreateApprovalParams): Promise<ApprovalRequest> {
    // Verificar que la sesión existe
    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, params.sessionId),
    })

    if (!session) {
      throw new Error("Session not found")
    }

    if (session.tenantId !== params.tenantId) {
      throw new Error("Session does not belong to tenant")
    }

    // Calcular fecha de expiración
    const expiresAt = new Date()
    expiresAt.setMinutes(expiresAt.getMinutes() + (params.expiresIn || 60))

    // Crear solicitud de aprobación
    const [request] = await db
      .insert(approvalRequests)
      .values({
        tenantId: params.tenantId,
        sessionId: params.sessionId,
        toolName: params.toolName,
        toolParams: params.toolParams,
        requestedBy: params.requestedBy,
        status: "pending",
        expiresAt,
      })
      .returning()

    return request
  }

  /**
   * Obtiene una solicitud por ID
   */
  async getRequest(
    requestId: string,
    tenantId: string
  ): Promise<ApprovalRequest | null> {
    const request = await db.query.approvalRequests.findFirst({
      where: and(
        eq(approvalRequests.id, requestId),
        eq(approvalRequests.tenantId, tenantId)
      ),
    })

    return request || null
  }

  /**
   * Lista solicitudes pendientes de un tenant
   */
  async listPending(
    tenantId: string,
    options?: {
      limit?: number
      offset?: number
      sessionId?: string
    }
  ): Promise<ApprovalRequest[]> {
    const conditions = [
      eq(approvalRequests.tenantId, tenantId),
      eq(approvalRequests.status, "pending"),
    ]

    if (options?.sessionId) {
      conditions.push(eq(approvalRequests.sessionId, options.sessionId))
    }

    const requests = await db.query.approvalRequests.findMany({
      where: and(...conditions),
      orderBy: [desc(approvalRequests.createdAt)],
      limit: options?.limit,
      offset: options?.offset,
    })

    // Filtrar solicitudes expiradas
    const now = new Date()
    const validRequests = requests.filter((r) => !r.expiresAt || r.expiresAt > now)

    return validRequests
  }

  /**
   * Aprueba una solicitud y ejecuta la herramienta
   */
  async approve(
    requestId: string,
    tenantId: string,
    decision: ApprovalDecision
  ): Promise<{ request: ApprovalRequest; result?: any }> {
    // Obtener solicitud
    const request = await this.getRequest(requestId, tenantId)
    if (!request) {
      throw new Error("Approval request not found")
    }

    if (request.status !== "pending") {
      throw new Error(`Request already ${request.status}`)
    }

    // Verificar expiración
    if (request.expiresAt && request.expiresAt < new Date()) {
      await this.updateStatus(requestId, tenantId, "expired")
      throw new Error("Approval request has expired")
    }

    // Actualizar estado a aprobado
    await db
      .update(approvalRequests)
      .set({
        status: "approved",
        reviewedBy: decision.reviewedBy,
        reviewedAt: new Date(),
        notes: decision.notes,
      })
      .where(eq(approvalRequests.id, requestId))

    // Ejecutar la herramienta
    try {
      const context = {
        tenantId,
        workspacePath: "", // Se obtiene del workspace del tenant
        sessionId: request.sessionId,
        userId: decision.reviewedBy,
      }

      const result = await executeTool(request.toolName, request.toolParams, context)

      // Guardar resultado
      await db
        .update(approvalRequests)
        .set({ executionResult: result })
        .where(eq(approvalRequests.id, requestId))

      return {
        request: { ...request, status: "approved" as ApprovalStatus },
        result,
      }
    } catch (error) {
      // Guardar error
      await db
        .update(approvalRequests)
        .set({
          executionError: error instanceof Error ? error.message : String(error),
        })
        .where(eq(approvalRequests.id, requestId))

      throw error
    }
  }

  /**
   * Rechaza una solicitud
   */
  async reject(
    requestId: string,
    tenantId: string,
    decision: ApprovalDecision
  ): Promise<ApprovalRequest> {
    const request = await this.getRequest(requestId, tenantId)
    if (!request) {
      throw new Error("Approval request not found")
    }

    if (request.status !== "pending") {
      throw new Error(`Request already ${request.status}`)
    }

    const [updated] = await db
      .update(approvalRequests)
      .set({
        status: "rejected",
        reviewedBy: decision.reviewedBy,
        reviewedAt: new Date(),
        notes: decision.notes,
      })
      .where(eq(approvalRequests.id, requestId))
      .returning()

    return updated
  }

  /**
   * Actualiza el estado de una solicitud
   */
  async updateStatus(
    requestId: string,
    tenantId: string,
    status: ApprovalStatus
  ): Promise<ApprovalRequest | null> {
    const [updated] = await db
      .update(approvalRequests)
      .set({ status })
      .where(
        and(
          eq(approvalRequests.id, requestId),
          eq(approvalRequests.tenantId, tenantId)
        )
      )
      .returning()

    return updated || null
  }

  /**
   * Limpia solicitudes expiradas
   */
  async cleanExpired(): Promise<number> {
    const now = new Date()

    const expired = await db
      .update(approvalRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(approvalRequests.status, "pending"),
          //.expiresAt menor que ahora
          // (Drizzle no tiene lt directamente, usamos sql template)
          // Aquí simplificamos obteniendo todos y filtrando
        )
      )
      .returning()

    // Filtrar por expiración en memoria (no es lo más eficiente pero funciona)
    const actuallyExpired = expired.filter((e) => e.expiresAt && e.expiresAt < now)

    for (const request of actuallyExpired) {
      await db
        .update(approvalRequests)
        .set({ status: "expired" })
        .where(eq(approvalRequests.id, request.id))
    }

    return actuallyExpired.length
  }

  /**
   * Verifica si una herramienta requiere aprobación
   */
  requiresApproval(toolName: string): boolean {
    // Por defecto, las herramientas del sistema requieren aprobación
    const systemTools = [
      "http_request",
      "db_query",
      "schedule_task",
      "whatsapp_send",
      "bash", // Bash también requiere aprobación por seguridad
    ]

    return systemTools.includes(toolName)
  }

  /**
   * Solicita aprobación para ejecutar una herramienta
   */
  async requestApproval(
    tenantId: string,
    sessionId: string,
    toolName: string,
    toolParams: any,
    userId?: string
  ): Promise<ApprovalRequest> {
    return this.createRequest({
      tenantId,
      sessionId,
      toolName,
      toolParams,
      requestedBy: userId,
    })
  }
}

export const approvalService = new ApprovalService()

/**
 * Inicializa el cleaner de solicitudes expiradas
 * Ejecuta cada 5 minutos
 */
export function initApprovalCleaner(): void {
  setInterval(() => {
    approvalService.cleanExpired().catch(console.error)
  }, 5 * 60 * 1000)
}
