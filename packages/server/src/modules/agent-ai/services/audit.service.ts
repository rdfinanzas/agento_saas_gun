/**
 * Audit Service - SP-9: Logs y Auditoría
 *
 * Servicio centralizado para registrar eventos de auditoría
 * y ejecuciones de herramientas.
 */

import { db } from "@/db"
import {
  auditLogs,
  toolExecutions,
  type NewAuditLog,
  type NewToolExecution,
  type ToolExecutionStatus,
  type AuditAction,
  type AuditResourceType,
} from "@/db/schema"
import { eq, and, desc, count } from "drizzle-orm"
import { ulid } from "ulid"

export interface AuditLogParams {
  tenantId: string
  action: AuditAction
  resourceType?: AuditResourceType
  resourceId?: string
  details?: Record<string, any>
  success?: "yes" | "no" | "partial"
  errorMessage?: string
  userId?: string
  ipAddress?: string
  userAgent?: string
  requestId?: string
}

export interface ToolExecutionParams {
  tenantId: string
  sessionId?: string
  toolName: string
  toolParams: any
  approvalId?: string
  requiresApproval?: "pending" | "approved" | "rejected" | "none"
}

/**
 * Servicio de auditoría
 */
export class AuditService {
  /**
   * Registra un evento de auditoría
   */
  async log(params: AuditLogParams): Promise<void> {
    const log: NewAuditLog = {
      tenantId: params.tenantId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      details: params.details || {},
      success: params.success || "yes",
      errorMessage: params.errorMessage,
      userId: params.userId,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      requestId: params.requestId,
    }

    await db.insert(auditLogs).values(log)
  }

  /**
   * Crea un registro de ejecución de herramienta
   */
  async createToolExecution(params: ToolExecutionParams): Promise<string> {
    const id = ulid()

    const execution: NewToolExecution = {
      id,
      tenantId: params.tenantId,
      sessionId: params.sessionId,
      toolName: params.toolName,
      toolParams: params.toolParams,
      status: "running",
      approvalId: params.approvalId,
      requiresApproval: params.requiresApproval || "none",
    }

    await db.insert(toolExecutions).values(execution)

    return id
  }

  /**
   * Actualiza el estado de una ejecución de herramienta
   */
  async updateToolExecution(
    id: string,
    tenantId: string,
    update: {
      status: ToolExecutionStatus
      result?: any
      error?: string
      durationMs?: number
    }
  ): Promise<void> {
    const data: any = {
      status: update.status,
    }

    if (update.result !== undefined) {
      data.result = update.result
    }

    if (update.error !== undefined) {
      data.error = update.error
    }

    if (update.durationMs !== undefined) {
      data.durationMs = update.durationMs
    }

    if (update.status !== "running") {
      data.completedAt = new Date()
    }

    await db
      .update(toolExecutions)
      .set(data)
      .where(and(eq(toolExecutions.id, id), eq(toolExecutions.tenantId, tenantId)))
  }

  /**
   * Registra una ejecución exitosa de herramienta
   */
  async logToolSuccess(
    id: string,
    tenantId: string,
    result: any,
    durationMs: number
  ): Promise<void> {
    await this.updateToolExecution(id, tenantId, {
      status: "success",
      result,
      durationMs,
    })
  }

  /**
   * Registra una ejecución fallida de herramienta
   */
  async logToolFailure(
    id: string,
    tenantId: string,
    error: string,
    durationMs?: number
  ): Promise<void> {
    await this.updateToolExecution(id, tenantId, {
      status: "failed",
      error,
      durationMs,
    })
  }

  /**
   * Cancela una ejecución de herramienta
   */
  async cancelToolExecution(id: string, tenantId: string): Promise<void> {
    await this.updateToolExecution(id, tenantId, {
      status: "cancelled",
    })
  }

  /**
   * Obtiene logs de auditoría de un tenant
   */
  async getAuditLogs(
    tenantId: string,
    options?: {
      limit?: number
      offset?: number
      action?: AuditAction
      resourceType?: AuditResourceType
      resourceId?: string
      userId?: string
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{ logs: typeof auditLogs.$inferSelect; total: number }> {
    const conditions = [eq(auditLogs.tenantId, tenantId)]

    if (options?.action) {
      conditions.push(eq(auditLogs.action, options.action))
    }

    if (options?.resourceType) {
      conditions.push(eq(auditLogs.resourceType, options.resourceType))
    }

    if (options?.resourceId) {
      conditions.push(eq(auditLogs.resourceId, options.resourceId))
    }

    if (options?.userId) {
      conditions.push(eq(auditLogs.userId, options.userId))
    }

    // TODO: Agregar filtros de fecha cuando Drizzle lo soporte mejor

    const logs = await db.query.auditLogs.findMany({
      where: and(...conditions),
      orderBy: [desc(auditLogs.createdAt)],
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    })

    // Obtener total
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(auditLogs)
      .where(and(...conditions))

    return { logs, total }
  }

  /**
   * Obtiene ejecuciones de herramientas de un tenant
   */
  async getToolExecutions(
    tenantId: string,
    options?: {
      limit?: number
      offset?: number
      sessionId?: string
      toolName?: string
      status?: ToolExecutionStatus
      startDate?: Date
      endDate?: Date
    }
  ): Promise<{ executions: typeof toolExecutions.$inferSelect; total: number }> {
    const conditions = [eq(toolExecutions.tenantId, tenantId)]

    if (options?.sessionId) {
      conditions.push(eq(toolExecutions.sessionId, options.sessionId))
    }

    if (options?.toolName) {
      conditions.push(eq(toolExecutions.toolName, options.toolName))
    }

    if (options?.status) {
      conditions.push(eq(toolExecutions.status, options.status))
    }

    const executions = await db.query.toolExecutions.findMany({
      where: and(...conditions),
      orderBy: [desc(toolExecutions.startedAt)],
      limit: options?.limit || 100,
      offset: options?.offset || 0,
    })

    // Obtener total
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(toolExecutions)
      .where(and(...conditions))

    return { executions, total }
  }

  /**
   * Obtiene estadísticas de uso de herramientas
   */
  async getToolStats(
    tenantId: string,
    options?: {
      startDate?: Date
      endDate?: Date
    }
  ): Promise<
    Array<{
      toolName: string
      total: number
      success: number
      failed: number
      avgDurationMs: number
    }>
  > {
    // TODO: Implementar con SQL raw o cuando Drizzle agregue soporte
    // Por ahora, retornamos estadísticas básicas
    const executions = await db.query.toolExecutions.findMany({
      where: eq(toolExecutions.tenantId, tenantId),
      orderBy: [desc(toolExecutions.startedAt)],
      limit: 1000,
    })

    const stats = new Map<
      string,
      { total: number; success: number; failed: number; totalDuration: number }
    >()

    for (const exec of executions) {
      const existing = stats.get(exec.toolName) || {
        total: 0,
        success: 0,
        failed: 0,
        totalDuration: 0,
      }

      existing.total++
      if (exec.status === "success") existing.success++
      if (exec.status === "failed") existing.failed++
      if (exec.durationMs) existing.totalDuration += exec.durationMs

      stats.set(exec.toolName, existing)
    }

    return Array.from(stats.entries()).map(([toolName, data]) => ({
      toolName,
      total: data.total,
      success: data.success,
      failed: data.failed,
      avgDurationMs: data.totalDuration / data.total || 0,
    }))
  }

  /**
   * Limpia logs antiguos (retention policy)
   */
  async cleanOldLogs(retentionDays: number = 90): Promise<{
    auditLogsDeleted: number
    toolExecutionsDeleted: number
  }> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

    // TODO: Implementar con SQL raw para eliminar por fecha
    // Por ahora retornamos 0
    return {
      auditLogsDeleted: 0,
      toolExecutionsDeleted: 0,
    }
  }
}

export const auditService = new AuditService()

/**
 * Middleware de Hono para inyectar audit service en el contexto
 */
export function auditMiddleware() {
  return async (c: any, next: any) => {
    // Generar request ID si no existe
    const requestId = c.get("requestId") || ulid()
    c.set("requestId", requestId)

    // Inyectar servicio de auditoría
    c.set("audit", auditService)

    await next()
  }
}

/**
 * Inicializa el cleaner de logs antiguos
 */
export function initAuditCleaner(retentionDays: number = 90): void {
  // Ejecutar una vez al día a las 3 AM
  const schedule = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(3, 0, 0, 0)

    const delay = tomorrow.getTime() - now.getTime()

    setTimeout(() => {
      auditService.cleanOldLogs(retentionDays).catch(console.error)
      schedule() // Re-schedule next day
    }, delay)
  }

  schedule()
}
