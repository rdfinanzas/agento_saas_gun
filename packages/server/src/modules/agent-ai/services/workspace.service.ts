/**
 * Workspace Manager Service
 *
 * Gestiona los workspaces (directorios de trabajo) de cada tenant.
 * Cada tenant tiene un directorio dedicado con subdirectorios organizados.
 */
import { db } from "@/db"
import { workspaces, type Workspace, type NewWorkspace } from "@/db/schema/workspace"
import { eq } from "drizzle-orm"
import * as fs from "fs"
import * as path from "path"

// Subdirectorios dentro de cada workspace
const WORKSPACE_SUBDIRS = {
  tools: "tools", // Código de herramientas creadas por el agente
  agents: "agents", // Agentes hijos creados por el codificador
  code: "code", // Código generado
  temp: "temp", // Archivos temporales
  logs: "logs", // Logs de ejecución
  data: "data", // Datos persistentes
  config: "config", // Configuraciones
} as const

// Tipo para los subdirectorios disponibles
export type WorkspaceSubdir = keyof typeof WORKSPACE_SUBDIRS

export class WorkspaceManager {
  private basePath: string

  constructor() {
    // Base path desde env o default
    this.basePath = process.env.WORKSPACES_PATH || path.join(process.cwd(), "workspaces")
    this.ensureBasePath()
  }

  /**
   * Asegura que el directorio base existe
   */
  private ensureBasePath(): void {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true })
      console.log(`[WorkspaceManager] Created base workspace path: ${this.basePath}`)
    }
  }

  /**
   * Obtiene la ruta del workspace para un tenant
   * Lo crea si no existe
   */
  async getWorkspacePath(tenantId: string): Promise<string> {
    const workspace = await this.getWorkspace(tenantId)
    return workspace.path
  }

  /**
   * Obtiene el registro del workspace de la DB
   * Lo crea si no existe
   */
  async getWorkspace(tenantId: string): Promise<Workspace> {
    // Buscar en DB
    const existing = await db.query.workspaces.findFirst({
      where: eq(workspaces.tenantId, tenantId),
    })

    if (existing) {
      // Asegurar que el directorio existe
      this.ensureWorkspaceDirs(existing.path)
      return existing
    }

    // Crear nuevo workspace
    return this.createWorkspace(tenantId)
  }

  /**
   * Crea un nuevo workspace para un tenant
   */
  async createWorkspace(tenantId: string): Promise<Workspace> {
    const workspacePath = path.join(this.basePath, tenantId)

    // Crear estructura de directorios
    this.ensureWorkspaceDirs(workspacePath)

    // Crear archivo README en el workspace
    const readmePath = path.join(workspacePath, "README.md")
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(
        readmePath,
        `# Workspace ${tenantId}\n\nEste directorio contiene los archivos del agente codificador.\n\n## Estructura\n\n- \`tools/\`: Herramientas creadas\n- \`agents/\`: Agentes hijos\n- \`code/\`: Código generado\n- \`temp/\`: Archivos temporales\n- \`logs/\`: Logs de ejecución\n- \`data/\`: Datos persistentes\n- \`config/\`: Configuraciones\n`
      )
    }

    // Guardar en DB
    const [workspace] = await db
      .insert(workspaces)
      .values({
        tenantId,
        path: workspacePath,
        isActive: true,
      })
      .returning()

    console.log(`[WorkspaceManager] Created workspace for tenant ${tenantId}: ${workspacePath}`)

    return workspace
  }

  /**
   * Asegura que todos los subdirectorios del workspace existen
   */
  private ensureWorkspaceDirs(workspacePath: string): void {
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true })
    }

    for (const subdir of Object.values(WORKSPACE_SUBDIRS)) {
      const fullPath = path.join(workspacePath, subdir)
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true })
      }
    }
  }

  /**
   * Obtiene la ruta de un subdirectorio específico
   */
  async getSubPath(tenantId: string, subdir: WorkspaceSubdir): Promise<string> {
    const workspacePath = await this.getWorkspacePath(tenantId)
    return path.join(workspacePath, WORKSPACE_SUBDIRS[subdir])
  }

  /**
   * Obtiene la ruta completa para un archivo en el workspace
   */
  async getFilePath(
    tenantId: string,
    subdir: WorkspaceSubdir,
    filename: string
  ): Promise<string> {
    const subdirPath = await this.getSubPath(tenantId, subdir)
    return path.join(subdirPath, filename)
  }

  /**
   * Verifica si un path está dentro del workspace del tenant
   * (para seguridad - prevenir path traversal)
   */
  async isWithinWorkspace(tenantId: string, targetPath: string): Promise<boolean> {
    const workspacePath = await this.getWorkspacePath(tenantId)
    const resolvedTarget = path.resolve(targetPath)
    const resolvedWorkspace = path.resolve(workspacePath)

    return resolvedTarget.startsWith(resolvedWorkspace + path.sep) ||
      resolvedTarget === resolvedWorkspace
  }

  /**
   * Limpia archivos temporales del workspace
   */
  async cleanTempFiles(tenantId: string): Promise<void> {
    const tempPath = await this.getSubPath(tenantId, "temp")

    if (fs.existsSync(tempPath)) {
      const files = fs.readdirSync(tempPath)
      for (const file of files) {
        const filePath = path.join(tempPath, file)
        try {
          fs.unlinkSync(filePath)
        } catch (error) {
          console.error(`[WorkspaceManager] Error deleting temp file ${filePath}:`, error)
        }
      }
      console.log(`[WorkspaceManager] Cleaned ${files.length} temp files for tenant ${tenantId}`)
    }
  }

  /**
   * Elimina el workspace de un tenant (soft delete en DB, archivos opcionales)
   */
  async deleteWorkspace(
    tenantId: string,
    options?: { deleteFiles?: boolean }
  ): Promise<void> {
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.tenantId, tenantId),
    })

    if (!workspace) return

    // Marcar como inactivo en DB
    await db
      .update(workspaces)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(workspaces.tenantId, tenantId))

    // Eliminar archivos si se solicita
    if (options?.deleteFiles && fs.existsSync(workspace.path)) {
      fs.rmSync(workspace.path, { recursive: true, force: true })
      console.log(`[WorkspaceManager] Deleted workspace files for tenant ${tenantId}`)
    }

    console.log(`[WorkspaceManager] Deactivated workspace for tenant ${tenantId}`)
  }

  /**
   * Obtiene información del espacio usado
   */
  async getWorkspaceStats(
    tenantId: string
  ): Promise<{ totalSize: number; fileCount: number; subdirStats: Record<string, { size: number; count: number }> }> {
    const workspacePath = await this.getWorkspacePath(tenantId)
    const subdirStats: Record<string, { size: number; count: number }> = {}

    let totalSize = 0
    let fileCount = 0

    for (const [name, subdir] of Object.entries(WORKSPACE_SUBDIRS)) {
      const subdirPath = path.join(workspacePath, subdir)
      const stats = this.getDirStats(subdirPath)
      subdirStats[name] = stats
      totalSize += stats.size
      fileCount += stats.count
    }

    return { totalSize, fileCount, subdirStats }
  }

  /**
   * Calcula el tamaño y cantidad de archivos de un directorio
   */
  private getDirStats(dirPath: string): { size: number; count: number } {
    let size = 0
    let count = 0

    if (!fs.existsSync(dirPath)) {
      return { size: 0, count: 0 }
    }

    const traverseDir = (currentPath: string) => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const entryPath = path.join(currentPath, entry.name)

        if (entry.isDirectory()) {
          traverseDir(entryPath)
        } else if (entry.isFile()) {
          try {
            const stats = fs.statSync(entryPath)
            size += stats.size
            count++
          } catch {
            // Ignorar errores de archivos inaccesibles
          }
        }
      }
    }

    traverseDir(dirPath)
    return { size, count }
  }
}

// Singleton instance
export const workspaceManager = new WorkspaceManager()
