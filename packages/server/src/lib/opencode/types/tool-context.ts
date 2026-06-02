/**
 * Tool Context - Contexto de ejecución para herramientas del SaaS
 *
 * Proporciona información sobre el tenant, workspace y usuario
 * durante la ejecución de una herramienta.
 */

export interface ToolContext {
  /** ID del tenant actual */
  tenantId: string
  /** Ruta del workspace del tenant */
  workspacePath: string
  /** ID del usuario que ejecuta (opcional) */
  userId?: string
  /** ID de la sesión del agente (opcional) */
  sessionId?: string
  /** Signal para abortar la ejecución */
  abort?: AbortSignal
  /** Función para solicitar permisos (approval workflow) */
  askPermission?: (permission: PermissionRequest) => Promise<PermissionResponse>
  /** Función para actualizar metadatos durante la ejecución */
  metadata?: (data: { metadata: Record<string, any> }) => void
}

export interface PermissionRequest {
  /** Tipo de permiso solicitado */
  permission: "read" | "write" | "bash" | "glob" | "grep"
  /** Patrones de archivos afectados */
  patterns: string[]
  /** Patrones que siempre se permiten */
  always: string[]
  /** Metadatos adicionales */
  metadata?: Record<string, any>
}

export interface PermissionResponse {
  /** Si el permiso fue concedido */
  granted: boolean
  /** Razón si fue denegado */
  reason?: string
}

export interface ToolResult {
  /** Si la operación fue exitosa */
  success?: boolean
  /** Título del resultado */
  title?: string
  /** Contenido de salida */
  output?: string
  /** Metadatos adicionales */
  metadata?: Record<string, any>
  /** Adjuntos (imágenes, archivos) */
  attachments?: Array<{
    type: string
    mime: string
    url: string
  }>
}

/**
 * Validación de paths - Asegura que un path esté dentro del workspace
 */
export class PathValidator {
  /**
   * Valida que un path esté dentro del workspace
   * @throws Error si el path está fuera del workspace
   */
  static validate(workspacePath: string, targetPath: string): void {
    const path = require("path")
    const normalizedWorkspace = path.resolve(workspacePath)
    const normalizedTarget = path.resolve(
      path.isAbsolute(targetPath)
        ? targetPath
        : path.join(workspacePath, targetPath)
    )

    // Check if the path is trying to escape the workspace using .. or similar
    const relativePath = path.relative(normalizedWorkspace, normalizedTarget)

    // If the relative path starts with .., it means the target is outside the workspace
    if (relativePath.startsWith("..")) {
      throw new Error(
        `Access denied: path "${targetPath}" is outside workspace boundaries`
      )
    }
  }

  /**
   * Resuelve un path relativo al workspace
   */
  static resolve(workspacePath: string, targetPath: string): string {
    const path = require("path")
    return path.isAbsolute(targetPath)
      ? targetPath
      : path.resolve(workspacePath, targetPath)
  }

  /**
   * Obtiene el path relativo al workspace
   */
  static relative(workspacePath: string, targetPath: string): string {
    return require("path").relative(workspacePath, targetPath)
  }
}
