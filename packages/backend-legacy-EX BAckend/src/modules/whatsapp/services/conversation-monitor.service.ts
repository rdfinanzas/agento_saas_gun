import { prisma } from '../../../config/database';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';

export class ConversationMonitorService {
  private whatsappApi = new WhatsAppCloudApiService();

  async getActiveConversations(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: {
        messages: { orderBy: { createdAt: 'asc' }, take: 50 },
        config: { select: { agentMode: true, agentInstructions: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getHumanTakeoverConversations(tenantId: string) {
    return prisma.conversation.findMany({
      where: { tenantId, status: 'HUMAN_TAKEOVER' },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        config: { select: { agentMode: true } }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  async getConversation(tenantId: string, conversationId: string) {
    return prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        config: true
      }
    });
  }

  async takeOver(tenantId: string, conversationId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId }
    });

    if (!conversation) {
      throw new Error('Conversation not found');
    }

    // Add system message about takeover
    await prisma.message.create({
      data: {
        tenantId,
        conversationId,
        messageId: `system_${Date.now()}`,
        fromPhone: 'SYSTEM',
        toPhone: conversation.phoneNumber,
        direction: 'OUTGOING',
        type: 'SYSTEM',
        content: `Human takeover initiated by user ${userId}`,
        status: 'SENT',
        metadata: { action: 'HUMAN_TAKEOVER', userId }
      }
    });

    return prisma.conversation.update({
      where: { id: conversationId },
      data: { status: 'HUMAN_TAKEOVER' }
    });
  }

  async releaseControl(tenantId: string, conversationId: string) {
    return prisma.conversation.update({
      where: { id: conversationId, tenantId },
      data: { status: 'ACTIVE' }
    });
  }

  async sendManualMessage(
    tenantId: string,
    conversationId: string,
    content: string,
    userId: string
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      include: { config: true }
    });

    if (!conversation || !conversation.config) {
      throw new Error('Conversation or config not found');
    }

    // Send via WhatsApp
    await this.whatsappApi.sendTextMessage({
      phoneNumberId: conversation.config.phoneNumberId,
      accessToken: conversation.config.accessToken,
      to: conversation.phoneNumber,
      message: content
    });

    // Save message
    return prisma.message.create({
      data: {
        tenantId,
        conversationId,
        messageId: `manual_${Date.now()}`,
        fromPhone: conversation.config.phoneNumberId,
        toPhone: conversation.phoneNumber,
        direction: 'OUTGOING',
        type: 'TEXT',
        content,
        status: 'SENT',
        metadata: { sentBy: userId, manual: true }
      }
    });
  }

  async closeConversation(tenantId: string, conversationId: string) {
    return prisma.conversation.update({
      where: { id: conversationId, tenantId },
      data: { status: 'CLOSED' }
    });
  }

  async getStats(tenantId: string) {
    const [active, humanTakeover, closed, total] = await Promise.all([
      prisma.conversation.count({ where: { tenantId, status: 'ACTIVE' } }),
      prisma.conversation.count({ where: { tenantId, status: 'HUMAN_TAKEOVER' } }),
      prisma.conversation.count({ where: { tenantId, status: 'CLOSED' } }),
      prisma.conversation.count({ where: { tenantId } })
    ]);

    return { active, humanTakeover, closed, total };
  }
}

export const conversationMonitorService = new ConversationMonitorService();
