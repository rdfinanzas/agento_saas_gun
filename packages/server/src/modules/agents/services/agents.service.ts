import { eq, and, or, like, sql, desc, isNull } from "drizzle-orm"
import { db } from "../../../db"
import { agents, tenants } from "../../../db/schema"
import { AgentType, AgentStatus, AgentAccessType } from "../../auth/types"

export interface CreateAgentInput {
  tenantId: string
  name: string
  description?: string
  type?: AgentType
  role?: string
  style?: string
  language?: string
  systemPrompt?: string
  instructions?: string
  accessType?: AgentAccessType
  workspaceEnabled?: boolean
  allowedTools?: string[]
  blockedTools?: string[]
  parentId?: string
}

export interface UpdateAgentInput {
  name?: string
  description?: string
  type?: AgentType
  role?: string
  style?: string
  language?: string
  systemPrompt?: string
  instructions?: string
  accessType?: AgentAccessType
  workspaceEnabled?: boolean
  allowedTools?: string[]
  blockedTools?: string[]
  parentId?: string | null
  status?: AgentStatus
}

export interface AgentFilterOptions {
  tenantId: string
  type?: AgentType
  status?: AgentStatus
  accessType?: AgentAccessType
  parentId?: string
  search?: string
  page?: number
  limit?: number
}

export interface AgentWithRelations {
  id: string
  tenantId: string
  name: string
  description: string | null
  type: string
  status: string
  role: string | null
  style: string | null
  language: string | null
  systemPrompt: string | null
  instructions: string | null
  accessType: string
  workspaceEnabled: boolean
  allowedTools: string[]
  blockedTools: string[]
  parentId: string | null
  createdAt: Date
  updatedAt: Date
  parent?: AgentWithRelations | null
  children?: AgentWithRelations[]
  _count?: {
    whatsappConfigs: number
    integrations: number
    conversations: number
  }
}

class AgentsService {
  /**
   * Crea un nuevo agente
   */
  async create(data: CreateAgentInput) {
    // Validar límites del plan
    await this.validateAgentLimit(data.tenantId)

    // Validar padre si existe
    if (data.parentId) {
      const parent = await db.query.agents.findFirst({
        where: and(eq(agents.id, data.parentId), eq(agents.tenantId, data.tenantId)),
      })
      if (!parent) {
        throw new Error("Invalid parent agent")
      }
    }

    const [agent] = await db
      .insert(agents)
      .values({
        tenantId: data.tenantId,
        name: data.name,
        description: data.description,
        type: data.type || "INTERNAL",
        role: data.role,
        style: data.style,
        language: data.language || "es",
        systemPrompt: data.systemPrompt,
        instructions: data.instructions,
        accessType: data.accessType || "PRIVATE",
        workspaceEnabled: data.workspaceEnabled || false,
        allowedTools: data.allowedTools || [],
        blockedTools: data.blockedTools || [],
        parentId: data.parentId,
        status: "DRAFT",
      })
      .returning()

    return agent
  }

  /**
   * Obtiene un agente por ID
   */
  async getById(id: string, tenantId: string, includeRelations = false): Promise<AgentWithRelations | null> {
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.tenantId, tenantId)),
      with: includeRelations
        ? {
            parent: true,
            children: true,
          }
        : undefined,
    })

    if (!agent) return null

    // Get counts if relations are included
    if (includeRelations) {
      const [whatsappConfigs, integrations, conversations] = await Promise.all([
        db.query.whatsappConfigs.findMany({ where: eq(agents.id, id) }),
        db.query.agentIntegrations.findMany({ where: eq(agents.id, id) }),
        db.query.conversations.findMany({ where: eq(agents.id, id) }),
      ])

      return {
        ...agent,
        _count: {
          whatsappConfigs: whatsappConfigs.length,
          integrations: integrations.length,
          conversations: conversations.length,
        },
      } as AgentWithRelations
    }

    return agent as AgentWithRelations
  }

  /**
   * Lista agentes con filtros y paginación
   */
  async list(options: AgentFilterOptions) {
    const { tenantId, type, status, accessType, parentId, search, page = 1, limit = 20 } = options
    const skip = (page - 1) * limit

    // Build where conditions - exclude ARCHIVED by default
    const conditions = [eq(agents.tenantId, tenantId)]

    if (type) conditions.push(eq(agents.type, type))
    if (status) {
      conditions.push(eq(agents.status, status))
    } else {
      // By default, exclude archived agents
      conditions.push(sql`${agents.status} != 'ARCHIVED'`)
    }
    if (accessType) conditions.push(eq(agents.accessType, accessType))
    if (parentId !== undefined) {
      if (parentId === "null") {
        conditions.push(isNull(agents.parentId))
      } else {
        conditions.push(eq(agents.parentId, parentId))
      }
    }

    const agentsList = await db.query.agents.findMany({
      where: and(...conditions),
      limit,
      offset: skip,
      orderBy: [desc(agents.createdAt)],
      with: {
        parent: true,
      },
    })

    // Get total count
    const allAgents = await db.query.agents.findMany({
      where: and(...conditions),
      columns: { id: true },
    })
    const total = allAgents.length

    return {
      agents: agentsList,
      total,
      page,
      limit,
    }
  }

  /**
   * Actualiza un agente
   */
  async update(id: string, tenantId: string, data: UpdateAgentInput) {
    // Verificar que el agente existe y pertenece al tenant
    const existing = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.tenantId, tenantId)),
    })

    if (!existing) {
      throw new Error("Agent not found")
    }

    // Validar padre si se está cambiando
    if (data.parentId) {
      if (data.parentId === id) {
        throw new Error("Agent cannot be its own parent")
      }

      const parent = await db.query.agents.findFirst({
        where: eq(agents.id, data.parentId),
      })

      if (!parent || parent.tenantId !== tenantId) {
        throw new Error("Invalid parent agent")
      }
    }

    const [updated] = await db
      .update(agents)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning()

    return updated
  }

  /**
   * Elimina un agente (soft delete: archivar)
   */
  async delete(id: string, tenantId: string) {
    const existing = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.tenantId, tenantId)),
      with: {
        whatsappConfigs: true,
        conversations: true,
      },
    })

    if (!existing) {
      throw new Error("Agent not found")
    }

    // Soft delete: always archive (logical deletion)
    // Deactivate WhatsApp configs if present
    if (existing.whatsappConfigs && existing.whatsappConfigs.length > 0) {
      const { whatsappConfigs } = await import("../../../db/schema")
      for (const config of existing.whatsappConfigs) {
        await db
          .update(whatsappConfigs)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(whatsappConfigs.id, config.id))
      }
    }

    const [archived] = await db
      .update(agents)
      .set({ status: "ARCHIVED", updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning()

    return archived
  }

  /**
   * Cambia el estado de un agente
   */
  async setStatus(id: string, tenantId: string, status: AgentStatus) {
    const existing = await db.query.agents.findFirst({
      where: and(eq(agents.id, id), eq(agents.tenantId, tenantId)),
    })

    if (!existing) {
      throw new Error("Agent not found")
    }

    const [updated] = await db
      .update(agents)
      .set({ status, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning()

    return updated
  }

  /**
   * Duplica un agente
   */
  async duplicate(id: string, tenantId: string, newName?: string) {
    const existing = await this.getById(id, tenantId, true)

    if (!existing) {
      throw new Error("Agent not found")
    }

    // Validar límites
    await this.validateAgentLimit(tenantId)

    const [duplicated] = await db
      .insert(agents)
      .values({
        tenantId,
        name: newName || `${existing.name} (copia)`,
        description: existing.description,
        type: existing.type as AgentType,
        role: existing.role,
        style: existing.style,
        language: existing.language,
        systemPrompt: existing.systemPrompt,
        instructions: existing.instructions,
        accessType: existing.accessType as AgentAccessType,
        workspaceEnabled: existing.workspaceEnabled,
        allowedTools: existing.allowedTools,
        blockedTools: existing.blockedTools,
        status: "DRAFT",
      })
      .returning()

    return duplicated
  }

  /**
   * Obtiene agentes por tipo
   */
  async getByType(tenantId: string, type: AgentType, activeOnly = true) {
    const conditions = [eq(agents.tenantId, tenantId), eq(agents.type, type)]

    if (activeOnly) {
      conditions.push(eq(agents.status, "ACTIVE"))
    }

    return db.query.agents.findMany({
      where: and(...conditions),
      orderBy: [desc(agents.createdAt)],
    })
  }

  /**
   * Obtiene el árbol jerárquico de agentes
   */
  async getHierarchy(tenantId: string) {
    return db.query.agents.findMany({
      where: and(eq(agents.tenantId, tenantId), isNull(agents.parentId)),
      with: {
        children: {
          with: {
            children: true,
          },
        },
      },
      orderBy: [desc(agents.createdAt)],
    })
  }

  /**
   * Obtiene estadísticas de agentes
   */
  async getStats(tenantId: string) {
    const allAgents = await db.query.agents.findMany({
      where: eq(agents.tenantId, tenantId),
    })

    const byStatus = {
      active: allAgents.filter((a) => a.status === "ACTIVE").length,
      draft: allAgents.filter((a) => a.status === "DRAFT").length,
      archived: allAgents.filter((a) => a.status === "ARCHIVED").length,
    }

    const byType = {
      INTERNAL: allAgents.filter((a) => a.type === "INTERNAL").length,
      EXTERNAL: allAgents.filter((a) => a.type === "EXTERNAL").length,
    }

    return {
      total: allAgents.length,
      byStatus,
      byType,
    }
  }

  /**
   * Valida si el tenant puede crear más agentes según su plan
   */
  private async validateAgentLimit(tenantId: string): Promise<void> {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      with: {
        agents: true,
      },
    })

    if (!tenant) {
      throw new Error("Tenant not found")
    }

    const agentCount = tenant.agents.filter((a) => a.status !== "ARCHIVED").length

    // Límites según plan
    const limits: Record<string, number> = {
      FREE: 3,
      PRO: 10,
      ENTERPRISE: -1, // ilimitado
    }

    const limit = limits[tenant.subscriptionTier] ?? limits.FREE

    if (limit !== -1 && agentCount >= limit) {
      throw new Error(`Agent limit reached for ${tenant.subscriptionTier} plan`)
    }
  }

  /**
   * Obtiene estadísticas de agentes para un tenant
   */
  async getStats(tenantId: string) {
    const allAgents = await db.query.agents.findMany({
      where: eq(agents.tenantId, tenantId),
    })

    const byStatus = {
      active: allAgents.filter((a) => a.status === "ACTIVE").length,
      draft: allAgents.filter((a) => a.status === "DRAFT").length,
      archived: allAgents.filter((a) => a.status === "ARCHIVED").length,
    }

    const byType = {
      internal: allAgents.filter((a) => a.type === "INTERNAL").length,
      external: allAgents.filter((a) => a.type === "EXTERNAL").length,
    }

    return {
      total: allAgents.length,
      byStatus,
      byType,
    }
  }
}

export const agentsService = new AgentsService()
