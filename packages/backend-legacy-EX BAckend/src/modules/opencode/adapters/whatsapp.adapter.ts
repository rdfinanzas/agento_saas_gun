import { OpenCodeExecutorService, ExecutionContext } from '../services/opencode-executor.service';
import { prisma } from '../../../config/database';

export interface WhatsAppResponse {
  content: string;
  conversationId: string;
  messageId: string;
  timestamp: Date;
}

/**
 * Adaptador que integra OpenCode con WhatsApp
 * Maneja la conversación, contexto y persistencia
 */
export class WhatsAppAdapter {
  constructor(private executor: OpenCodeExecutorService) {}

  /**
   * Genera una respuesta usando OpenCode para un mensaje de WhatsApp
   */
  async generateResponse(
    message: string,
    tenantId: string,
    phoneNumber: string,
    fromPhone: string
  ): Promise<WhatsAppResponse> {
    // CORRECCIÓN: Usar WhatsAppConfig en lugar de Agent
    const config = await prisma.whatsAppConfig.findFirst({
      where: { tenantId, isActive: true }
    });

    if (!config) {
      throw new Error('No hay configuración de WhatsApp activa para este tenant');
    }

    // Obtener o crear conversación
    const conversation = await this.getOrCreateConversation(
      tenantId,
      phoneNumber,
      config.id
    );

    // CORRECCIÓN: Usar ConversationContext para historial
    const contextRecord = await this.getOrCreateContext(tenantId);

    // Guardar mensaje entrante
    await prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        messageId: `in_${Date.now()}`,
        fromPhone,
        toPhone: config.phoneNumberId,
        direction: 'INCOMING',
        type: 'TEXT',
        content: message,
        status: 'RECEIVED'
      }
    });

    // Construir contexto de ejecución
    const executionContext: ExecutionContext = {
      tenantId,
      mode: config.agentMode as any,
      workspacePath: `./storage/tenants/${tenantId}/workspace`,
      conversationHistory: contextRecord.messages as any[],
      agentInstructions: config.agentInstructions,
      knowledgeBase: config.knowledgeBase as any,
      timeout: 120000, // 2 minutos
    };

    // Ejecutar OpenCode
    const result = await this.executor.execute(message, executionContext);

    if (result.error) {
      // En caso de error, responder con mensaje de error
      const errorResponse = this.formatErrorResponse(result.error);
      await this.updateContextWithError(tenantId, message, result.error);
      return {
        content: errorResponse,
        conversationId: conversation.id,
        messageId: `out_${Date.now()}`,
        timestamp: new Date(),
      };
    }

    // Actualizar historial de conversación
    await this.updateContextWithMessage(
      tenantId,
      message,
      result.content
    );

    return {
      content: result.content,
      conversationId: conversation.id,
      messageId: `out_${Date.now()}`,
      timestamp: new Date(),
    };
  }

  /**
   * Obtiene o crea una conversación de WhatsApp
   */
  private async getOrCreateConversation(
    tenantId: string,
    phoneNumber: string,
    configId: string
  ) {
    // Buscar conversación existente
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId,
        phoneNumber,
        configId,
      }
    });

    if (!conversation) {
      // Crear nueva conversación
      conversation = await prisma.conversation.create({
        data: {
          tenantId,
          phoneNumber,
          configId,
          status: 'ACTIVE',
          lastMessageAt: new Date(),
        }
      });
    } else {
      // Actualizar timestamp
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date() }
      });
    }

    return conversation;
  }

  /**
   * Obtiene o crea un contexto de conversación
   * CORRECCIÓN: Usar ConversationContext en lugar de Memory
   */
  private async getOrCreateContext(tenantId: string) {
    let context = await prisma.conversationContext.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP_AGENT'
      }
    });

    if (!context) {
      context = await prisma.conversationContext.create({
        data: {
          tenantId,
          type: 'WHATSAPP_AGENT',
          messages: [],
          memory: {}
        }
      });
    }

    return context;
  }

  /**
   * Actualiza el contexto con un nuevo mensaje
   * CORRECCIÓN: Usar campo messages en ConversationContext
   */
  private async updateContextWithMessage(
    tenantId: string,
    userMessage: string,
    assistantResponse: string
  ) {
    const context = await this.getOrCreateContext(tenantId);

    const currentMessages = context.messages as any[];
    const newMessages = [
      ...currentMessages,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date().toISOString()
      }
    ];

    // Mantener solo los últimos 50 mensajes para no sobrecargar
    const trimmedMessages = newMessages.slice(-50);

    await prisma.conversationContext.update({
      where: { id: context.id },
      data: {
        messages: trimmedMessages
      }
    });
  }

  /**
   * Actualiza el contexto con información de error
   */
  private async updateContextWithError(
    tenantId: string,
    userMessage: string,
    error: string
  ) {
    const context = await this.getOrCreateContext(tenantId);

    const currentMessages = context.messages as any[];
    const newMessages = [
      ...currentMessages,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date().toISOString()
      },
      {
        role: 'system',
        content: `Error: ${error}`,
        timestamp: new Date().toISOString()
      }
    ];

    await prisma.conversationContext.update({
      where: { id: context.id },
      data: {
        messages: newMessages.slice(-50)
      }
    });
  }

  /**
   * Formatea un mensaje de error amigable
   */
  private formatErrorResponse(error: string): string {
    if (error.includes('Timeout')) {
      return 'Lo siento, tardé mucho en procesar tu solicitud. Por favor intenta de nuevo con una pregunta más breve.';
    }

    if (error.includes('no está disponible')) {
      return 'Lo siento, el servicio de IA no está disponible en este momento. Por favor intenta más tarde.';
    }

    return 'Lo siento, ocurrió un error al procesar tu mensaje. Por favor intenta de nuevo.';
  }

  /**
   * Limpia el historial de conversación de un tenant
   */
  async clearConversationHistory(tenantId: string): Promise<void> {
    const context = await prisma.conversationContext.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP_AGENT'
      }
    });

    if (context) {
      await prisma.conversationContext.update({
        where: { id: context.id },
        data: {
          messages: [],
          memory: {}
        }
      });
    }
  }

  /**
   * Obtiene estadísticas de conversación
   */
  async getConversationStats(tenantId: string) {
    const context = await prisma.conversationContext.findFirst({
      where: {
        tenantId,
        type: 'WHATSAPP_AGENT'
      }
    });

    const messages = context?.messages as any[] || [];
    const conversationsCount = await prisma.conversation.count({
      where: { tenantId }
    });

    return {
      totalMessages: messages.length,
      conversationsCount,
      lastMessageAt: messages.length > 0
        ? messages[messages.length - 1].timestamp
        : null,
    };
  }
}
