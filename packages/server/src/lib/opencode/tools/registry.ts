/**
 * ToolRegistry - Registro centralizado de herramientas
 *
 * Administra todas las herramientas BASE disponibles para los agentes
 * en el contexto de AgenTo SaaS.
 */

import { ToolContext, ToolResult } from "../types/tool-context"

/**
 * Definición de una herramienta
 */
export interface Tool<
  TParams extends Record<string, any> = Record<string, any>,
> {
  /** Nombre único de la herramienta */
  name: string
  /** Descripción de lo que hace la herramienta */
  description: string
  /** Parámetros que acepta la herramienta (opcional, para documentación) */
  parameters?: {
    type: "object"
    properties: Record<string, {
      type: string
      description: string
      enum?: string[]
      optional?: boolean
    }>
    required: string[]
  }
  /** Función de ejecución */
  execute: (params: TParams, context: ToolContext) => Promise<ToolResult>
  /** Si la herramienta requiere aprobación antes de ejecutarse */
  requiresApproval?: boolean
}

/**
 * Registro de herramientas BASE
 */
export class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  /**
   * Registra una herramienta
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`)
    }
    this.tools.set(tool.name, tool)
  }

  /**
   * Obtiene una herramienta por nombre
   */
  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  /**
   * Lista todas las herramientas registradas
   */
  list(): Tool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Obtiene los nombres de todas las herramientas
   */
  names(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Ejecuta una herramienta
   */
  async execute(name: string, params: any, context: ToolContext): Promise<ToolResult> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new Error(`Tool not found: ${name}`)
    }

    return tool.execute(params, context)
  }

  /**
   * Genera el schema de herramientas para el LLM
   * Formato compatible con Anthropic/Claude
   */
  toLLMFormat(): Array<{
    name: string
    description: string
    input_schema: {
      type: "object"
      properties: Record<string, {
        type: string
        description: string
        enum?: string[]
      }>
      required: string[]
    }
  }> {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters || {
        type: "object",
        properties: {},
        required: [],
      },
    }))
  }
}

/**
 * Instancia global del registro
 */
export const toolRegistry = new ToolRegistry()

/**
 * Registra todas las herramientas BASE
 */
export async function registerBaseTools(): Promise<void> {
  // Importar herramientas dinámicamente para evitar dependencias circulares
  const { read_file } = await import("./read-file")
  const { write_file } = await import("./write-file")
  const { edit_file } = await import("./edit-file")
  const { bash } = await import("./bash")
  const { glob } = await import("./glob")
  const { grep } = await import("./grep")

  toolRegistry.register(read_file as any)
  toolRegistry.register(write_file as any)
  toolRegistry.register(edit_file as any)
  toolRegistry.register(bash as any)
  toolRegistry.register(glob as any)
  toolRegistry.register(grep as any)
}

/**
 * Inicializa el registro de herramientas
 */
export async function initializeTools(): Promise<void> {
  await registerBaseTools()
}

// Auto-inicializar en importación (opcional)
// initializeTools().catch(console.error)
