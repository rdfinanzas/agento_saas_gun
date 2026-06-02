/**
 * AgentCoderService - Servicio para el Agente Codificador
 *
 * El Agente Codificador (MASTER) es el agente principal que puede:
 * - Crear nuevos agentes
 * - Crear tools
 * - Configurar agentes existentes
 * - Integrar APIs externas
 *
 * Cada tenant tiene su propio Agente Codificador.
 */

import { db } from "@/db/connection"
import { agents, type Agent, type NewAgent } from "@/db/schema/agent"
import { skills } from "@/db/schema/skill"
import { tools } from "@/db/schema/tool"
import { eq, and } from "drizzle-orm"
import { skillRegistry } from "./skill-registry.service"
import { toolRegistry } from "./tool-registry.service"
import { createLogger } from "@/utils/logger"

const logger = createLogger("agent-coder")

// ============================================
// Types
// ============================================

export interface CreateAgentInput {
  tenantId: string
  name: string
  description?: string
  type: "INTERNAL" | "EXTERNAL"
  systemPrompt?: string
  instructions?: string
  role?: string
  style?: string
  language?: string
  allowedTools?: string[]
  blockedTools?: string[]
}

export interface CreateToolInput {
  tenantId: string
  agentId?: string // Si es null, es tool global del codificador
  name: string
  description?: string
  code: string
  parameters: Record<string, unknown>
  canExecuteCode?: boolean
}

// ============================================
// AgentCoderService Class
// ============================================

class AgentCoderService {
  /**
   * Obtiene o crea el Agente Codificador (MASTER) para un tenant
   */
  async getOrCreateCoder(tenantId: string): Promise<Agent> {
    // Buscar agente codificador existente
    const [existing] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.tenantId, tenantId),
          eq(agents.type, "MASTER"),
          eq(agents.status, "ACTIVE")
        )
      )
      .limit(1)

    if (existing) {
      return existing
    }

    // Crear nuevo agente codificador
    logger.info(`Creating MASTER agent for tenant ${tenantId}`)

    const [coder] = await db
      .insert(agents)
      .values({
        tenantId,
        name: "Agente Codificador",
        description: "Agente principal que puede crear y configurar otros agentes",
        type: "MASTER",
        status: "ACTIVE",
        role: "Codificador de Agentes",
        style: "Técnico y preciso",
        language: "es",
        systemPrompt: `Eres el Agente Codificador de AgenTo, una plataforma de agentes de IA.

Tu función es crear, configurar y mantener agentes especializados para los usuarios.

Puedes:
- Crear nuevos agentes (INTERNAL o EXTERNAL)
- Crear tools personalizadas
- Configurar agentes existentes
- Integrar APIs externas

Cuando crees un agente:
1. Analiza la documentación del usuario
2. Determina el tipo apropiado (INTERNAL si necesita ejecutar código, EXTERNAL si no)
3. Diseña las tools necesarias
4. Crea el agente con su configuración

Siempre explica lo que estás haciendo y confirma antes de ejecutar acciones críticas.`,
        instructions: "Crear agentes especializados según las necesidades del usuario",
        accessType: "PRIVATE",
        workspaceEnabled: true,
        allowedTools: ["read", "write", "bash", "glob", "create_agent", "create_tool"],
        blockedTools: [],
      })
      .returning()

    // Inicializar skills del codificador
    await skillRegistry.initializeCoderSkills(tenantId)

    logger.info(`MASTER agent created: ${coder.id}`)
    return coder
  }

  /**
   * Crea un nuevo agente (hijo del codificador)
   */
  async createAgent(input: CreateAgentInput): Promise<Agent> {
    // Obtener el codificador para establecer parentId
    const coder = await this.getOrCreateCoder(input.tenantId)

    // Validar que el nombre no exista
    const [existing] = await db
      .select()
      .from(agents)
      .where(
        and(
          eq(agents.tenantId, input.tenantId),
          eq(agents.name, input.name)
        )
      )
      .limit(1)

    if (existing) {
      throw new Error(`Ya existe un agente con el nombre "${input.name}"`)
    }

    // Configurar tools según el tipo
    let allowedTools = input.allowedTools || []
    let blockedTools = input.blockedTools || []

    // INTERNAL hereda tools del codificador + las suyas
    // EXTERNAL no puede usar tools que ejecutan código
    if (input.type === "EXTERNAL") {
      // Filtrar tools que ejecutan código
      blockedTools = [...blockedTools, "write", "bash", "create_agent", "create_tool"]
    }

    const [agent] = await db
      .insert(agents)
      .values({
        tenantId: input.tenantId,
        name: input.name,
        description: input.description || "",
        type: input.type,
        status: "DRAFT", // Inicia como borrador
        role: input.role || "",
        style: input.style || "",
        language: input.language || "es",
        systemPrompt: input.systemPrompt || "",
        instructions: input.instructions || "",
        accessType: "PRIVATE",
        workspaceEnabled: input.type === "INTERNAL",
        allowedTools,
        blockedTools,
        parentId: coder.id,
      })
      .returning()

    logger.info(`Agent created: ${agent.id} (${agent.type})`)
    return agent
  }

  /**
   * Crea una nueva tool
   */
  async createTool(input: CreateToolInput): Promise<typeof tools.$inferSelect> {
    // Validar que el nombre no exista
    const [existing] = await db
      .select()
      .from(tools)
      .where(
        and(
          eq(tools.tenantId, input.tenantId),
          eq(tools.name, input.name)
        )
      )
      .limit(1)

    if (existing) {
      throw new Error(`Ya existe una tool con el nombre "${input.name}"`)
    }

    const [tool] = await db
      .insert(tools)
      .values({
        tenantId: input.tenantId,
        agentId: input.agentId || null,
        name: input.name,
        description: input.description || "",
        code: input.code,
        parameters: input.parameters,
        canExecuteCode: input.canExecuteCode ?? true,
        isSystem: false,
      })
      .returning()

    // Limpiar cache de tools
    toolRegistry.clearCache(input.tenantId)

    logger.info(`Tool created: ${tool.id} (${tool.name})`)
    return tool
  }

  /**
   * Activa un agente (cambia de DRAFT a ACTIVE)
   */
  async activateAgent(agentId: string, tenantId: string): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({
        status: "ACTIVE",
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
      .returning()

    if (!agent) {
      throw new Error("Agente no encontrado")
    }

    logger.info(`Agent activated: ${agent.id}`)
    return agent
  }

  /**
   * Pausa un agente (cambia a PAUSED)
   */
  async pauseAgent(agentId: string, tenantId: string): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({
        status: "PAUSED",
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
      .returning()

    if (!agent) {
      throw new Error("Agente no encontrado")
    }

    logger.info(`Agent paused: ${agent.id}`)
    return agent
  }

  /**
   * Obtiene todos los agentes de un tenant (incluyendo el codificador)
   */
  async listAgents(tenantId: string): Promise<Agent[]> {
    return db.select().from(agents).where(eq(agents.tenantId, tenantId))
  }

  /**
   * Obtiene los agentes hijos de un agente
   */
  async getChildAgents(parentId: string, tenantId: string): Promise<Agent[]> {
    return db
      .select()
      .from(agents)
      .where(and(eq(agents.parentId, parentId), eq(agents.tenantId, tenantId)))
  }

  /**
   * Obtiene un agente por ID
   */
  async getAgent(agentId: string, tenantId: string): Promise<Agent | null> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
      .limit(1)

    return agent || null
  }

  /**
   * Actualiza un agente
   */
  async updateAgent(
    agentId: string,
    tenantId: string,
    data: Partial<{
      name: string
      description: string
      systemPrompt: string
      instructions: string
      allowedTools: string[]
      blockedTools: string[]
      role: string
      style: string
    }>
  ): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
      .returning()

    if (!agent) {
      throw new Error("Agente no encontrado")
    }

    logger.info(`Agent updated: ${agent.id}`)
    return agent
  }

  /**
   * Elimina un agente (solo si no es MASTER)
   */
  async deleteAgent(agentId: string, tenantId: string): Promise<boolean> {
    // Verificar que no sea MASTER
    const agent = await this.getAgent(agentId, tenantId)
    if (!agent) {
      throw new Error("Agente no encontrado")
    }
    if (agent.type === "MASTER") {
      throw new Error("No se puede eliminar el agente codificador")
    }

    // Eliminar tools asociadas
    await db.delete(tools).where(eq(tools.agentId, agentId))

    // Eliminar skills asociadas
    await db.delete(skills).where(eq(skills.agentId, agentId))

    // Eliminar agente
    const result = await db
      .delete(agents)
      .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
      .returning()

    logger.info(`Agent deleted: ${agentId}`)
    return result.length > 0
  }
}

// Singleton
export const agentCoderService = new AgentCoderService()
