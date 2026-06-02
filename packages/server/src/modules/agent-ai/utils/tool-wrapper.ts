/**
 * Tool Wrapper - Helper para ejecutar herramientas con auditoría
 *
 * Envuelve la ejecución de herramientas para registrar
 * automáticamente logs de auditoría y métricas.
 */

import { auditService } from "../services/audit.service"
import type { ToolContext, ToolResult } from "@/lib/opencode/tools"
import { executeTool } from "@/lib/opencode/tools"

export interface ToolExecutionOptions {
  tenantId: string
  sessionId?: string
  userId?: string
  toolName: string
  toolParams: any
  approvalId?: string
  requiresApproval?: "pending" | "approved" | "rejected" | "none"
  workspacePath: string
}

/**
 * Ejecuta una herramienta con logging automático
 */
export async function executeToolWithAudit(
  options: ToolExecutionOptions
): Promise<{ executionId: string; result: ToolResult }> {
  // Crear registro de ejecución
  const executionId = await auditService.createToolExecution({
    tenantId: options.tenantId,
    sessionId: options.sessionId,
    toolName: options.toolName,
    toolParams: options.toolParams,
    approvalId: options.approvalId,
    requiresApproval: options.requiresApproval,
  })

  const startTime = Date.now()

  try {
    // Ejecutar herramienta
    const context: ToolContext = {
      tenantId: options.tenantId,
      workspacePath: options.workspacePath,
      sessionId: options.sessionId,
      userId: options.userId,
    }

    const result = await executeTool(options.toolName, options.toolParams, context)

    // Registrar éxito
    const durationMs = Date.now() - startTime
    await auditService.logToolSuccess(executionId, options.tenantId, result, durationMs)

    // Log de auditoría
    await auditService.log({
      tenantId: options.tenantId,
      action: "tool_executed",
      resourceType: "tool",
      resourceId: options.toolName,
      details: {
        executionId,
        toolName: options.toolName,
        durationMs,
        sessionId: options.sessionId,
      },
      userId: options.userId,
    })

    return { executionId, result }
  } catch (error) {
    // Registrar error
    const durationMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : String(error)

    await auditService.logToolFailure(executionId, options.tenantId, errorMessage, durationMs)

    // Log de auditoría del error
    await auditService.log({
      tenantId: options.tenantId,
      action: "tool_failed",
      resourceType: "tool",
      resourceId: options.toolName,
      details: {
        executionId,
        toolName: options.toolName,
        durationMs,
        error: errorMessage,
      },
      success: "no",
      errorMessage,
      userId: options.userId,
    })

    throw error
  }
}

/**
 * Verifica si una herramienta requiere aprobación
 */
export function requiresApproval(toolName: string): boolean {
  const toolsRequiringApproval = [
    "bash",
    "http_request",
    "db_query",
    "schedule_task",
    "whatsapp_send",
  ]

  return toolsRequiringApproval.includes(toolName)
}

/**
 * Wrapper para herramientas que no requieren aprobación
 */
export async function executeToolDirectly(
  options: Omit<ToolExecutionOptions, "approvalId" | "requiresApproval">
): Promise<{ executionId: string; result: ToolResult }> {
  return executeToolWithAudit({
    ...options,
    requiresApproval: "none",
  })
}
