import { prisma } from '../../../config/database';

export interface CreateAgentData {
  phoneNumberId: string;
  accessToken?: string;
  webhookVerifyToken?: string;
  agentMode?: 'FULL' | 'LIMITED';
  agentInstructions?: string;
  knowledgeBase?: any;
  connectionType?: 'CLOUD_API' | 'BAILEYS';
  allowedTools?: string[];
  blockedTools?: string[];
}

export interface UpdateAgentData {
  agentMode?: 'FULL' | 'LIMITED';
  agentInstructions?: string;
  knowledgeBase?: any;
  isActive?: boolean;
}

export class AgentConfigService {
  async create(tenantId: string, data: CreateAgentData) {
    return prisma.whatsAppConfig.create({
      data: {
        tenantId,
        phoneNumberId: data.phoneNumberId,
        accessToken: data.accessToken || '',
        webhookVerifyToken: data.webhookVerifyToken || '',
        agentMode: data.agentMode || 'LIMITED',
        agentInstructions: data.agentInstructions,
        knowledgeBase: data.knowledgeBase || {},
        connectionType: data.connectionType || 'CLOUD_API',
        allowedTools: data.allowedTools || [],
        blockedTools: data.blockedTools || ['bash', 'write', 'edit', 'task'],
        isActive: true
      }
    });
  }

  async findByTenant(tenantId: string) {
    return prisma.whatsAppConfig.findMany({
      where: { tenantId },
      include: {
        _count: { select: { conversations: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async findById(id: string, tenantId: string) {
    return prisma.whatsAppConfig.findFirst({
      where: { id, tenantId },
      include: {
        conversations: {
          take: 10,
          orderBy: { updatedAt: 'desc' }
        }
      }
    });
  }

  async update(id: string, tenantId: string, data: UpdateAgentData) {
    return prisma.whatsAppConfig.update({
      where: { id, tenantId },
      data
    });
  }

  async updateKnowledgeBase(id: string, tenantId: string, knowledgeBase: any) {
    return prisma.whatsAppConfig.update({
      where: { id, tenantId },
      data: { knowledgeBase }
    });
  }

  async delete(id: string, tenantId: string) {
    return prisma.whatsAppConfig.delete({
      where: { id, tenantId }
    });
  }

  async toggleActive(id: string, tenantId: string) {
    const config = await this.findById(id, tenantId);
    if (!config) throw new Error('Config not found');
    
    return prisma.whatsAppConfig.update({
      where: { id, tenantId },
      data: { isActive: !config.isActive }
    });
  }

  async getStats(id: string, tenantId: string) {
    const config = await prisma.whatsAppConfig.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { conversations: true } },
        conversations: {
          where: { status: 'ACTIVE' },
          select: { id: true }
        }
      }
    });

    if (!config) return null;

    const totalMessages = await prisma.message.count({
      where: {
        tenantId,
        conversation: { configId: id }
      }
    });

    return {
      id: config.id,
      totalConversations: config._count.conversations,
      activeConversations: config.conversations.length,
      totalMessages,
      isActive: config.isActive,
      createdAt: config.createdAt
    };
  }
}

export const agentConfigService = new AgentConfigService();
