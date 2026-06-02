/**
 * Agents Service - CRUD de Agentes desacoplados
 *
 * Implementa la lógica de negocio para la gestión de agentes
 * independientes de canales (WhatsApp, Web Chat, etc.)
 */

import { PrismaClient, Agent, AgentType, AgentStatus, AgentAccessType, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface CreateAgentInput {
  tenantId: string;
  name: string;
  description?: string;
  type?: AgentType;
  role?: string;
  style?: string;
  language?: string;
  systemPrompt?: string;
  instructions?: string;
  accessType?: AgentAccessType;
  workspaceEnabled?: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
  parentId?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  type?: AgentType;
  status?: AgentStatus;
  role?: string;
  style?: string;
  language?: string;
  systemPrompt?: string;
  instructions?: string;
  accessType?: AgentAccessType;
  workspaceEnabled?: boolean;
  allowedTools?: string[];
  blockedTools?: string[];
  parentId?: string;
}

export interface AgentFilterOptions {
  tenantId: string;
  type?: AgentType;
  status?: AgentStatus;
  accessType?: AgentAccessType;
  parentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AgentWithRelations extends Agent {
  parent?: Agent | null;
  children?: Agent[];
  _count?: {
    whatsappConfigs?: number;
    integrations?: number;
    conversations?: number;
  };
}

// ============================================
// Servicio Principal
// ============================================

export class AgentsService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  /**
   * Crea un nuevo agente
   */
  async create(data: CreateAgentInput): Promise<Agent> {
    const { tenantId, parentId, ...agentData } = data;

    // Validar que el padre existe si se especifica
    if (parentId) {
      const parent = await this.prisma.agent.findUnique({
        where: { id: parentId },
      });

      if (!parent) {
        throw new Error('Parent agent not found');
      }

      if (parent.tenantId !== tenantId) {
        throw new Error('Parent agent belongs to a different tenant');
      }
    }

    // Validar límites según el plan del tenant
    await this.validateAgentLimit(tenantId);

    const agent = await this.prisma.agent.create({
      data: {
        ...agentData,
        tenantId,
        parentId,
      },
    });

    return agent;
  }

  /**
   * Obtiene un agente por ID
   */
  async getById(
    id: string,
    tenantId: string,
    includeRelations: boolean = false
  ): Promise<AgentWithRelations | null> {
    const agent = await this.prisma.agent.findFirst({
      where: {
        id,
        tenantId,
      },
      include: includeRelations ? {
        parent: true,
        children: true,
        _count: {
          select: {
            whatsappConfigs: true,
            integrations: true,
            conversations: true,
          },
        },
      } : undefined,
    });

    return agent as AgentWithRelations | null;
  }

  /**
   * Lista agentes con filtros y paginación
   */
  async list(options: AgentFilterOptions): Promise<{
    agents: AgentWithRelations[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      tenantId,
      type,
      status,
      accessType,
      parentId,
      search,
      page = 1,
      limit = 20,
    } = options;

    const skip = (page - 1) * limit;

    // Construir where clause
    const where: Prisma.AgentWhereInput = {
      tenantId,
      ...(type && { type }),
      ...(status && { status }),
      ...(accessType && { accessType }),
      ...(parentId !== undefined && { parentId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { role: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [agents, total] = await Promise.all([
      this.prisma.agent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          parent: true,
          _count: {
            select: {
              whatsappConfigs: true,
              integrations: true,
              conversations: true,
            },
          },
        },
      }),
      this.prisma.agent.count({ where }),
    ]);

    return {
      agents: agents as AgentWithRelations[],
      total,
      page,
      limit,
    };
  }

  /**
   * Actualiza un agente
   */
  async update(
    id: string,
    tenantId: string,
    data: UpdateAgentInput
  ): Promise<Agent> {
    // Verificar que el agente existe y pertenece al tenant
    const existing = await this.prisma.agent.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Agent not found');
    }

    // Validar padre si se está cambiando
    if (data.parentId) {
      if (data.parentId === id) {
        throw new Error('Agent cannot be its own parent');
      }

      const parent = await this.prisma.agent.findUnique({
        where: { id: data.parentId },
      });

      if (!parent || parent.tenantId !== tenantId) {
        throw new Error('Invalid parent agent');
      }
    }

    const agent = await this.prisma.agent.update({
      where: { id },
      data,
    });

    return agent;
  }

  /**
   * Elimina un agente (soft delete: archivar)
   */
  async delete(id: string, tenantId: string): Promise<Agent> {
    const existing = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: {
            whatsappConfigs: true,
            conversations: true,
          },
        },
      },
    });

    if (!existing) {
      throw new Error('Agent not found');
    }

    // Verificar si tiene dependencias
    if (existing._count.whatsappConfigs > 0) {
      throw new Error('Cannot delete agent with active WhatsApp configurations');
    }

    if (existing._count.conversations > 0) {
      throw new Error('Cannot delete agent with conversation history');
    }

    // Soft delete: archivar en lugar de eliminar
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });

    return agent;
  }

  /**
   * Cambia el estado de un agente
   */
  async setStatus(
    id: string,
    tenantId: string,
    status: AgentStatus
  ): Promise<Agent> {
    const existing = await this.prisma.agent.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      throw new Error('Agent not found');
    }

    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });

    return agent;
  }

  /**
   * Duplica un agente
   */
  async duplicate(id: string, tenantId: string, newName?: string): Promise<Agent> {
    const existing = await this.getById(id, tenantId, true);

    if (!existing) {
      throw new Error('Agent not found');
    }

    // Validar límites
    await this.validateAgentLimit(tenantId);

    const duplicated = await this.prisma.agent.create({
      data: {
        tenantId,
        name: newName || `${existing.name} (copia)`,
        description: existing.description,
        type: existing.type,
        role: existing.role,
        style: existing.style,
        language: existing.language,
        systemPrompt: existing.systemPrompt,
        instructions: existing.instructions,
        accessType: existing.accessType,
        workspaceEnabled: existing.workspaceEnabled,
        allowedTools: existing.allowedTools,
        blockedTools: existing.blockedTools,
        // No copiar el padre para evitar confusiones
        status: 'DRAFT',
      },
    });

    return duplicated;
  }

  /**
   * Obtiene agentes por tipo
   */
  async getByType(
    tenantId: string,
    type: AgentType,
    activeOnly: boolean = true
  ): Promise<Agent[]> {
    const where: Prisma.AgentWhereInput = {
      tenantId,
      type,
    };

    if (activeOnly) {
      where.status = 'ACTIVE';
    }

    return this.prisma.agent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Obtiene el árbol jerárquico de agentes
   */
  async getHierarchy(tenantId: string): Promise<Agent[]> {
    // Obtener todos los agentes del tenant
    const agents = await this.prisma.agent.findMany({
      where: {
        tenantId,
        parentId: null, // Solo raíces
      },
      include: {
        children: {
          include: {
            children: true, // 2 niveles de profundidad
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return agents;
  }

  // ============================================
  // Métodos Privados
  // ============================================

  /**
   * Valida si el tenant puede crear más agentes según su plan
   */
  private async validateAgentLimit(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        agents: true,
        plan: true,
      },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const agentCount = tenant.agents.filter(
      a => a.status !== 'ARCHIVED'
    ).length;

    // Límites según plan (se puede hacer más configurable)
    const limits: Record<string, number> = {
      FREE: 3,
      PRO: 10,
      ENTERPRISE: -1, // ilimitado
    };

    const limit = limits[tenant.subscriptionTier] ?? limits.FREE;

    if (limit !== -1 && agentCount >= limit) {
      throw new Error(
        `Agent limit reached for ${tenant.subscriptionTier} plan (${limit} agents)`
      );
    }
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const agentsService = new AgentsService();
