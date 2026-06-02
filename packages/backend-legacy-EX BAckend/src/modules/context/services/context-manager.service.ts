import { prisma } from '../../../config/database';
import { Prisma } from '@prisma/client';

export type ContextType = 'CHAT' | 'WHATSAPP_AGENT' | 'WORKSPACE';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
  metadata?: any;
}

export class ContextManagerService {
  async getOrCreateContext(tenantId: string, type: ContextType) {
    let context = await prisma.conversationContext.findFirst({
      where: { tenantId, type }
    });

    if (!context) {
      context = await prisma.conversationContext.create({
        data: { tenantId, type, messages: [], memory: {} }
      });
    }

    return context;
  }

  async addMessage(
    tenantId: string,
    type: ContextType,
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: any
  ) {
    const context = await this.getOrCreateContext(tenantId, type);
    const messages = (context.messages as unknown as Message[]) || [];

    const newMessage: Message = {
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    return prisma.conversationContext.update({
      where: { id: context.id },
      data: { messages: [...messages, newMessage] as unknown as Prisma.JsonObject }
    });
  }

  async getHistory(tenantId: string, type: ContextType, limit?: number) {
    const context = await this.getOrCreateContext(tenantId, type);
    let messages = (context.messages as unknown as Message[]) || [];

    if (limit) {
      messages = messages.slice(-limit);
    }

    return messages;
  }

  async clearHistory(tenantId: string, type: ContextType) {
    const context = await this.getOrCreateContext(tenantId, type);

    return prisma.conversationContext.update({
      where: { id: context.id },
      data: { messages: [] }
    });
  }

  async getContextStats(tenantId: string, type: ContextType) {
    const context = await this.getOrCreateContext(tenantId, type);
    const messages = (context.messages as unknown as Message[]) || [];

    return {
      totalMessages: messages.length,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt
    };
  }
}

export const contextManagerService = new ContextManagerService();
