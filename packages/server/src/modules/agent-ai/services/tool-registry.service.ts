/**
 * ToolRegistry Service
 *
 * Carga y ejecuta tools desde:
 * 1. Tools base en código (read, write, bash, etc.)
 * 2. Tools custom en base de datos
 *
 * Las tools se ejecutan en un sandbox de Bun para seguridad.
 */

import { db } from "@/db/connection"
import { tools, type Tool, type NewTool } from "@/db/schema/tool"
import { eq, and, or, isNull } from "drizzle-orm"
import { createLogger } from "@/utils/logger"

const logger = createLogger("tool-registry")

// ============================================
// Types
// ============================================

export interface ToolExecutionContext {
  tenantId: string
  agentId: string
  agentType: "MASTER" | "INTERNAL" | "EXTERNAL"
  sessionId?: string
  workspacePath?: string
}

export interface ToolResult {
  success: boolean
  data?: unknown
  error?: string
  duration: number
}

export interface ToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
  execute: (params: Record<string, unknown>, ctx: ToolExecutionContext) => Promise<ToolResult>
  canExecuteCode: boolean
  isSystem: boolean
}

// ============================================
// Base Tools (en código)
// ============================================

const BASE_TOOLS: Record<string, ToolDefinition> = {
  read: {
    name: "read",
    description: "Lee el contenido de un archivo",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del archivo" },
      },
      required: ["path"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        const file = Bun.file(params.path as string)
        const content = await file.text()
        return { success: true, data: content, duration: Date.now() - start }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  write: {
    name: "write",
    description: "Escribe contenido a un archivo",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Ruta del archivo" },
        content: { type: "string", description: "Contenido a escribir" },
      },
      required: ["path", "content"],
    },
    canExecuteCode: true,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        // EXTERNAL agents cannot write files
        if (ctx.agentType === "EXTERNAL") {
          return {
            success: false,
            error: "EXTERNAL agents cannot write files",
            duration: Date.now() - start,
          }
        }
        await Bun.write(params.path as string, params.content as string)
        return { success: true, duration: Date.now() - start }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  bash: {
    name: "bash",
    description: "Ejecuta un comando en la terminal",
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Comando a ejecutar" },
        cwd: { type: "string", description: "Directorio de trabajo" },
      },
      required: ["command"],
    },
    canExecuteCode: true,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        // EXTERNAL agents cannot execute bash commands
        if (ctx.agentType === "EXTERNAL") {
          return {
            success: false,
            error: "EXTERNAL agents cannot execute bash commands",
            duration: Date.now() - start,
          }
        }

        const result = Bun.spawnSync({
          cmd: ["bash", "-c", params.command as string],
          cwd: (params.cwd as string) || ctx.workspacePath || process.cwd(),
          timeout: 30000,
        })

        const output = result.stdout.toString() || result.stderr.toString()

        return {
          success: result.exitCode === 0,
          data: output,
          error: result.exitCode !== 0 ? output : undefined,
          duration: Date.now() - start,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  glob: {
    name: "glob",
    description: "Busca archivos por patrón",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Patrón de búsqueda (glob)" },
        path: { type: "string", description: "Directorio base" },
      },
      required: ["pattern"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        const glob = new Bun.Glob(params.pattern as string)
        const baseDir = (params.path as string) || ctx.workspacePath || process.cwd()
        const files = []
        for (const file of glob.scanSync({ cwd: baseDir })) {
          files.push(file)
        }
        return { success: true, data: files, duration: Date.now() - start }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  // Herramienta para crear agents (solo MASTER)
  create_agent: {
    name: "create_agent",
    description: "Crea un nuevo agente especializado",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre del agente" },
        type: { type: "string", enum: ["INTERNAL", "EXTERNAL"], description: "Tipo de agente" },
        description: { type: "string", description: "Descripción del agente" },
        systemPrompt: { type: "string", description: "Prompt del sistema" },
      },
      required: ["name", "type"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        // Solo MASTER puede crear agents
        if (ctx.agentType !== "MASTER") {
          return {
            success: false,
            error: "Only MASTER agent can create agents",
            duration: Date.now() - start,
          }
        }

        // Crear el agente en la base de datos
        const { agents: agentsTable } = await import("@/db/schema/agent");
        const [newAgent] = await db
          .insert(agentsTable)
          .values({
            tenantId: ctx.tenantId,
            name: (params.name as string) || "Nuevo Agente",
            type: (params.type as string) || "INTERNAL",
            description: (params.description as string) || "",
            systemPrompt: (params.systemPrompt as string) || "Eres un asistente util y amigable.",
            status: "ACTIVE",
          })
          .returning();

        return {
          success: true,
          data: {
            id: newAgent.id,
            name: newAgent.name,
            type: newAgent.type,
            description: newAgent.description,
            status: newAgent.status,
          },
          duration: Date.now() - start,
        }
      } catch (error) {
        console.error("[Tool] create_agent DB error:", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  // Herramienta para crear tools (solo MASTER)
  create_tool: {
    name: "create_tool",
    description: "Crea una nueva herramienta",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", description: "Nombre de la tool" },
        description: { type: "string", description: "Descripción" },
        code: { type: "string", description: "Código JavaScript de la tool" },
        parameters: { type: "object", description: "Schema de parámetros" },
      },
      required: ["name", "code"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now()
      try {
        // Solo MASTER puede crear tools
        if (ctx.agentType !== "MASTER") {
          return {
            success: false,
            error: "Only MASTER agent can create tools",
            duration: Date.now() - start,
          }
        }

        // Guardar en base de datos
        const [newTool] = await db
          .insert(tools)
          .values({
            tenantId: ctx.tenantId,
            agentId: null, // Tool global del codificador
            name: params.name as string,
            description: params.description as string,
            code: params.code as string,
            parameters: params.parameters as Record<string, unknown>,
            canExecuteCode: true,
            isSystem: false,
          })
          .returning()

        return { success: true, data: newTool, duration: Date.now() - start }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        }
      }
    },
  },

  // Listar agentes del tenant
  list_agents: {
    name: "list_agents",
    description: "Lista todos los agentes del tenant. Muestra nombre, tipo, estado y descripción.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now();
      try {
        const { agents: agentsTable } = await import("@/db/schema/agent");
        const { eq } = await import("drizzle-orm");
        const agentList = await db
          .select({
            id: agentsTable.id,
            name: agentsTable.name,
            type: agentsTable.type,
            status: agentsTable.status,
            description: agentsTable.description,
          })
          .from(agentsTable)
          .where(eq(agentsTable.tenantId, ctx.tenantId));

        return { success: true, data: agentList, duration: Date.now() - start };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        };
      }
    },
  },

  // Actualizar agente existente
  update_agent: {
    name: "update_agent",
    description: "Actualiza un agente existente. Permite cambiar nombre, descripción, estado y system prompt.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID del agente a actualizar" },
        name: { type: "string", description: "Nuevo nombre" },
        description: { type: "string", description: "Nueva descripción" },
        status: { type: "string", enum: ["ACTIVE", "PAUSED", "DRAFT"], description: "Nuevo estado" },
        systemPrompt: { type: "string", description: "Nuevo system prompt" },
      },
      required: ["agentId"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now();
      try {
        if (ctx.agentType !== "MASTER") {
          return {
            success: false,
            error: "Only MASTER agent can update agents",
            duration: Date.now() - start,
          };
        }

        const { agents: agentsTable } = await import("@/db/schema/agent");
        const updateData: Record<string, unknown> = {};
        if (params.name) updateData.name = params.name;
        if (params.description) updateData.description = params.description;
        if (params.status) updateData.status = params.status;
        if (params.systemPrompt) updateData.systemPrompt = params.systemPrompt;
        updateData.updatedAt = new Date();

        const [updated] = await db
          .update(agentsTable)
          .set(updateData)
          .where(eq(agentsTable.id, params.agentId as string))
          .returning();

        if (!updated) {
          return { success: false, error: "Agent not found", duration: Date.now() - start };
        }

        return { success: true, data: updated, duration: Date.now() - start };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        };
      }
    },
  },

  // Configurar integración con ERP (Dolibarr)
  configure_integration: {
    name: "configure_integration",
    description: "Configura la integración del agente con el sistema ERP (Dolibarr). Necesita URL y API key.",
    parameters: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "ID del agente" },
        erpUrl: { type: "string", description: "URL del ERP (ej: https://mi-dolibarr.com)" },
        apiKey: { type: "string", description: "API key del ERP" },
      },
      required: ["agentId", "erpUrl", "apiKey"],
    },
    canExecuteCode: false,
    isSystem: true,
    execute: async (params, ctx) => {
      const start = Date.now();
      try {
        if (ctx.agentType !== "MASTER") {
          return {
            success: false,
            error: "Only MASTER agent can configure integrations",
            duration: Date.now() - start,
          };
        }

        // Store integration in integrations table
        const { integrations: integrationsTable, agentIntegrations: agentIntegrationsTable } = await import("@/db/schema/integration");

        // Upsert integration
        const [existing] = await db
          .select()
          .from(integrationsTable)
          .where(eq(integrationsTable.tenantId, ctx.tenantId))
          .limit(1);

        let integrationId: string;
        if (existing) {
          await db
            .update(integrationsTable)
            .set({
              credentials: params.apiKey as string,
              baseUrl: params.erpUrl as string,
              status: "ACTIVE",
              updatedAt: new Date(),
            })
            .where(eq(integrationsTable.id, existing.id));
          integrationId = existing.id;
        } else {
          const [newInt] = await db
            .insert(integrationsTable)
            .values({
              tenantId: ctx.tenantId,
              name: "Dolibarr ERP",
              type: "ERP",
              credentials: params.apiKey as string,
              baseUrl: params.erpUrl as string,
              status: "ACTIVE",
            })
            .returning();
          integrationId = newInt.id;
        }

        // Link to agent
        await db
          .insert(agentIntegrationsTable)
          .values({
            agentId: params.agentId as string,
            integrationId: integrationId,
            tools: ["search_products", "check_stock", "create_order"],
            config: { erpUrl: params.erpUrl, apiKey: params.apiKey },
            status: "ACTIVE",
          })
          .onConflictDoNothing();

        return {
          success: true,
          data: { message: "Integration configured", erpUrl: params.erpUrl, agentId: params.agentId },
          duration: Date.now() - start,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          duration: Date.now() - start,
        };
      }
    },
  },
}

// ============================================
// ToolRegistry Class
// ============================================

class ToolRegistry {
  private customToolsCache: Map<string, ToolDefinition> = new Map()

  /**
   * Obtiene una tool por nombre
   */
  async getTool(name: string, tenantId: string): Promise<ToolDefinition | null> {
    // Primero buscar en tools base
    if (BASE_TOOLS[name]) {
      return BASE_TOOLS[name]
    }

    // Buscar en cache de tools custom
    const cacheKey = `${tenantId}:${name}`
    if (this.customToolsCache.has(cacheKey)) {
      return this.customToolsCache.get(cacheKey)!
    }

    // Buscar en base de datos
    const [tool] = await db
      .select()
      .from(tools)
      .where(and(eq(tools.tenantId, tenantId), eq(tools.name, name)))
      .limit(1)

    if (!tool) {
      return null
    }

    // Compilar y cachear la tool
    const toolDef = await this.compileTool(tool)
    this.customToolsCache.set(cacheKey, toolDef)
    return toolDef
  }

  /**
   * Obtiene todas las tools disponibles para un agente
   */
  async getToolsForAgent(
    tenantId: string,
    agentId: string,
    agentType: "MASTER" | "INTERNAL" | "EXTERNAL",
    parentId?: string
  ): Promise<ToolDefinition[]> {
    const result: ToolDefinition[] = []

    // 1. Agregar tools base según el tipo de agente
    for (const [name, tool] of Object.entries(BASE_TOOLS)) {
      // EXTERNAL no puede usar tools que ejecutan código
      if (agentType === "EXTERNAL" && tool.canExecuteCode) {
        continue
      }
      // Solo MASTER puede usar create_agent y create_tool
      if ((name === "create_agent" || name === "create_tool") && agentType !== "MASTER") {
        continue
      }
      result.push(tool)
    }

    // 2. Agregar tools custom del tenant
    const customTools = await db
      .select()
      .from(tools)
      .where(
        and(
          eq(tools.tenantId, tenantId),
          or(isNull(tools.agentId), eq(tools.agentId, agentId))
        )
      )

    for (const tool of customTools) {
      // EXTERNAL no puede usar tools que ejecutan código
      if (agentType === "EXTERNAL" && tool.canExecuteCode) {
        continue
      }

      const toolDef = await this.compileTool(tool)
      result.push(toolDef)
    }

    return result
  }

  /**
   * Compila una tool desde la base de datos
   */
  private async compileTool(tool: Tool): Promise<ToolDefinition> {
    const cacheKey = `${tool.tenantId}:${tool.name}`

    // Retornar de cache si existe
    if (this.customToolsCache.has(cacheKey)) {
      return this.customToolsCache.get(cacheKey)!
    }

    // Crear función desde el código
    const toolDef: ToolDefinition = {
      name: tool.name,
      description: tool.description || "",
      parameters: tool.parameters as Record<string, unknown>,
      canExecuteCode: tool.canExecuteCode,
      isSystem: tool.isSystem,
      execute: async (params, ctx) => {
        const start = Date.now()
        try {
          // Ejecutar en sandbox usando Function constructor
          // NOTA: En producción usar un sandbox más seguro
          const fn = new Function(
            "params",
            "ctx",
            "Bun",
            `return (async () => { ${tool.code} })()`
          )

          const result = await fn(params, ctx, Bun)
          return { success: true, data: result, duration: Date.now() - start }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
            duration: Date.now() - start,
          }
        }
      }
    }

    this.customToolsCache.set(cacheKey, toolDef)
    return toolDef
  }

  /**
   * Ejecuta una tool
   */
  async executeTool(
    name: string,
    params: Record<string, unknown>,
    ctx: ToolExecutionContext
  ): Promise<ToolResult> {
    const tool = await this.getTool(name, ctx.tenantId)

    if (!tool) {
      return {
        success: false,
        error: `Tool '${name}' not found`,
        duration: 0,
      }
    }

    // Verificar permisos
    if (ctx.agentType === "EXTERNAL" && tool.canExecuteCode) {
      return {
        success: false,
        error: `EXTERNAL agents cannot use tool '${name}' that executes code`,
        duration: 0,
      }
    }

    logger.info(`Executing tool: ${name}`, { agentId: ctx.agentId, agentType: ctx.agentType })
    return tool.execute(params, ctx)
  }

  /**
   * Limpia el cache de tools custom
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of this.customToolsCache.keys()) {
        if (key.startsWith(tenantId)) {
          this.customToolsCache.delete(key)
        }
      }
    } else {
      this.customToolsCache.clear()
    }
  }

  /**
   * Lista todas las tools base
   */
  listBaseTools(): ToolDefinition[] {
    return Object.values(BASE_TOOLS)
  }
}

// Singleton
export const toolRegistry = new ToolRegistry()
