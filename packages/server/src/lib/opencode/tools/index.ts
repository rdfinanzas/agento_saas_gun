/**
 * OpenCode Tools - Sistema de Herramientas para AgenTo SaaS
 *
 * Exporta todas las herramientas BASE, del SISTEMA y de USUARIO disponibles
 * para el agente codificador en el contexto SaaS multi-tenant.
 *
 * SP-3: Tools BASE
 * - read_file: Lee archivos del workspace
 * - write_file: Escribe o crea archivos
 * - edit_file: Edita archivos con diff
 * - bash: Ejecuta comandos en la terminal
 * - glob: Busca archivos por patrón
 * - grep: Busca texto en archivos
 *
 * SP-4: Tools del SISTEMA
 * - http_request: Hace requests HTTP a APIs externas
 * - db_query: Consulta bases de datos del cliente
 * - schedule_task: Programa tareas periódicas
 * - whatsapp_send: Envía mensajes por WhatsApp
 * - read_url: Lee contenido de URLs
 *
 * SP-5: Tools de USUARIO
 * - Herramientas dinámicas creadas por los usuarios
 * - Sandbox seguro con vm
 * - Permisos granulares
 * - Validación de código
 */

// ============================================
// SP-3: Tools BASE
// ============================================
import { read_file } from "./read-file"
import { write_file } from "./write-file"
import { edit_file } from "./edit-file"
import { bash } from "./bash"
import { glob } from "./glob"
import { grep } from "./grep"

export { read_file }
export type { ReadFileParams } from "./read-file"

export { write_file }
export type { WriteFileParams } from "./write-file"

export { edit_file }
export type { EditFileParams } from "./edit-file"

export { bash }
export type { BashParams } from "./bash"

export { glob }
export type { GlobParams } from "./glob"

export { grep }
export type { GrepParams } from "./grep"

// ============================================
// SP-4: Tools del SISTEMA
// ============================================
// These are imported lazily to avoid circular dependencies
export async function getSystemTools() {
  const { httpRequestTool } = await import("./http-request")
  const { dbQueryTool } = await import("./db-query")
  const { scheduleTaskTool } = await import("./schedule-task")
  const { whatsappSendTool } = await import("./whatsapp-send")
  const { readUrlTool } = await import("./read-url")

  return [
    httpRequestTool,
    dbQueryTool,
    scheduleTaskTool,
    whatsappSendTool,
    readUrlTool,
  ]
}

export { httpRequestTool } from "./http-request"
export { dbQueryTool } from "./db-query"
export { scheduleTaskTool } from "./schedule-task"
export { whatsappSendTool } from "./whatsapp-send"
export { readUrlTool } from "./read-url"

// Exportar aliases para funciones de ejecución
export { executeHttpRequest } from "./http-request"
export { executeDbQuery } from "./db-query"
export { executeScheduleTask } from "./schedule-task"
export { executeWhatsappSend } from "./whatsapp-send"
export { executeReadUrl } from "./read-url"

// ============================================
// Registry combinado
// ============================================
export const baseTools = [
  read_file,
  write_file,
  edit_file,
  bash,
  glob,
  grep,
]

/** Todas las herramientas base disponibles */
export const allTools = [...baseTools]

/**
 * Ejecuta una herramienta por nombre
 */
export async function executeTool(
  toolName: string,
  params: any,
  context: ToolContext
): Promise<ToolResult | any> {
  const tool = allTools.find((t) => t.name === toolName)
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`)
  }
  return await tool.execute(params, context)
}

// ============================================
// Types
// ============================================
export interface SystemTool {
  name: string
  description: string
  requiresApproval?: boolean
  parameters?: any
  execute: (params: any, context: ToolContext) => Promise<ToolResult>
}

export interface ToolContext {
  tenantId: string
  userId?: string
  sessionId?: string
  workspacePath: string
  abort?: AbortSignal
  askPermission?: (permission: PermissionRequest) => Promise<PermissionResponse>
  metadata?: (data: { metadata: Record<string, any> }) => void
}

export interface PermissionRequest {
  permission: "read" | "write" | "bash" | "glob" | "grep"
  patterns: string[]
  always: string[]
  metadata?: Record<string, any>
}

export interface PermissionResponse {
  granted: boolean
  reason?: string
}

export interface ToolResult {
  title?: string
  output?: string
  metadata?: Record<string, any>
  attachments?: Array<{
    type: string
    mime: string
    url: string
  }>
}
