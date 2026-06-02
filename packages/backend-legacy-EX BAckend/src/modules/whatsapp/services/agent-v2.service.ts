/**
 * WhatsApp Agent Service V2 - Servicio adaptado al nuevo modelo de Agentes
 *
 * Integra WhatsApp con el modelo desacoplado de Agentes.
 * Cada conversación tiene su propia sesión en Redis.
 *
 * Cambios principales:
 * - Usa Agent + WhatsAppConfig (en lugar de solo WhatsAppConfig)
 * - Sesiones por conversación en Redis
 * - Soporte para múltiples agentes por tenant
 */

import { PrismaClient, Agent, AgentType, ConversationStatus } from '@prisma/client';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';
import { redisSessionService } from '../../sessions/services/redis-session.service';
import { WhatsAppAdapter, WhatsAppContext, ConversationMessage } from '@agento/agent-core';
import { TenantManager } from '@agento/agent-core';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface ProcessMessageOptions {
  tenantId: string;
  configId: string;
  phoneNumber: string;
  message: string;
  messageId?: string;
}

export interface AgentResponse {
  response: string;
  confidence?: number;
  sessionId?: string;
  tokensUsed?: number;
  toolsUsed?: string[];
  executionTime?: number;
  requiresApproval?: boolean;
  pendingId?: string;
  approvalReason?: string;
}

export interface WhatsAppAgentConfig {
  agent: Agent;
  config: {
    id: string;
    phoneNumberId: string;
    isActive: boolean;
    agentMode: 'FULL' | 'LIMITED';
    requireApproval: boolean;
    greetingMessage?: string;
    awayMessage?: string;
  };
}

// ============================================
// Servicio Principal
// ============================================

export class WhatsAppAgentServiceV2 {
  private prisma: PrismaClient;
  private redis: typeof redisSessionService;
  private tenantManager: TenantManager;
  private adapters: Map<string, WhatsAppAdapter> = new Map();
  private conversations: Map<string, ConversationMessage[]> = new Map();

  constructor(
    private whatsappApi: WhatsAppCloudApiService
  ) {
    this.prisma = new PrismaClient();
    this.redis = redisSessionService;
    this.tenantManager = new TenantManager();
  }

  /**
   * Procesa un mensaje entrante de WhatsApp
   */
  async processIncomingMessage(options: ProcessMessageOptions): Promise<AgentResponse> {
    const { tenantId, configId, phoneNumber, message, messageId } = options;

    // 1. Obtener configuración de WhatsApp con su Agente vinculado
    const whatsappConfig = await this.prisma.whatsAppConfig.findFirst({
      where: {
        id: configId,
        tenantId,
        isActive: true,
      },
      include: {
        agent: true,
      },
    });

    if (!whatsappConfig) {
      throw new Error('WhatsApp configuration not found or inactive');
    }

    // Verificar si tiene un agente vinculado
    if (!whatsappConfig.agent) {
      // Comportamiento backward compatible: usar config antigua
      console.warn(`[WhatsAppAgentV2] No agent linked to config ${configId}, using legacy mode`);
      return this.legacyProcessMessage(options, whatsappConfig);
    }

    const agent = whatsappConfig.agent;

    // Verificar que el agente esté activo
    if (agent.status !== 'ACTIVE') {
      throw new Error(`Agent ${agent.name} is not active (status: ${agent.status})`);
    }

    // Verificar que el agente sea del tipo correcto
    if (agent.type !== AgentType.EXTERNAL) {
      console.warn(`[WhatsAppAgentV2] Agent ${agent.id} is not EXTERNAL type, processing anyway`);
    }

    // 2. Obtener o crear conversación
    const conversation = await this.getOrCreateConversation(
      tenantId,
      configId,
      phoneNumber,
      agent.id
    );

    // 3. Obtener o crear sesión en Redis para esta conversación
    const sessionKey = `${tenantId}:${agent.id}:${phoneNumber}`;
    let sessionData = await this.redis.get(tenantId, agent.id, phoneNumber);

    let opencodeSessionId: string;
    let conversationHistory: ConversationMessage[] = [];

    if (!sessionData) {
      // Crear nueva sesión
      opencodeSessionId = `wa_${tenantId}_${agent.id}_${phoneNumber}_${Date.now()}`;

      // Mensaje de bienvenida si es el primer mensaje
      if (whatsappConfig.greetingMessage && !conversation.lastMessageAt) {
        await this.sendGreetingMessage(tenantId, phoneNumber, whatsappConfig.greetingMessage);
      }

      await this.redis.set(
        tenantId,
        agent.id,
        phoneNumber,
        opencodeSessionId,
        'EXTERNAL',
        { ttl: 60 * 60 } // 1 hora para WhatsApp (más largo)
      );
    } else {
      opencodeSessionId = sessionData.opencodeSessionId;
      conversationHistory = this.conversations.get(sessionKey) || [];
      await this.redis.touch(tenantId, agent.id, phoneNumber);
    }

    // 4. Guardar mensaje entrante en BD
    await this.saveIncomingMessage(
      tenantId,
      conversation.id,
      phoneNumber,
      message,
      messageId
    );

    // 5. Agregar mensaje al historial
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversationHistory.push(userMessage);

    // 6. Obtener o crear adaptador
    let adapter = this.adapters.get(sessionKey);
    if (!adapter) {
      adapter = new WhatsAppAdapter();
      this.adapters.set(sessionKey, adapter);
    }

    // 7. Construir contexto del agente
    const agentContext: WhatsAppContext = {
      phoneNumber,
      contactName: conversation.contactName || phoneNumber,
      conversationHistory,
      metadata: {
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        agentStyle: agent.style,
        conversationId: conversation.id,
        configId: whatsappConfig.id,
        agentMode: whatsappConfig.agentMode,
        allowedTools: whatsappConfig.allowedTools || agent.allowedTools,
        blockedTools: whatsappConfig.blockedTools || agent.blockedTools,
        systemPrompt: this.buildSystemPrompt(agent, whatsappConfig),
      },
    };

    // 8. Ejecutar el agente
    const startTime = Date.now();

    try {
      const result = await adapter.execute(tenantId, message, agentContext);

      const executionTime = Date.now() - startTime;

      // 9. Verificar si requiere aprobación humana
      if (whatsappConfig.requireApproval) {
        const approvalRequired = await this.checkApprovalRequired(
          result.content,
          whatsappConfig
        );

        if (approvalRequired) {
          // Crear solicitud de aprobación
          const pendingResponse = await this.createPendingApproval(
            tenantId,
            conversation.id,
            agent.id,
            result.content,
            approvalRequired.reason
          );

          // Notificar via WebSocket
          this.emitPendingApproval(tenantId, {
            conversationId: conversation.id,
            phoneNumber,
            pendingId: pendingResponse.id,
            preview: result.content.substring(0, 100),
            reason: approvalRequired.reason,
          });

          return {
            response: result.content,
            requiresApproval: true,
            pendingId: pendingResponse.id,
            approvalReason: approvalRequired.reason,
          };
        }
      }

      // 10. Guardar respuesta en historial
      if (result.content) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date().toISOString(),
        };
        conversationHistory.push(assistantMessage);
      }

      // Guardar historial actualizado (limitar a últimos 50 mensajes para WhatsApp)
      const limitedHistory = conversationHistory.slice(-50);
      this.conversations.set(sessionKey, limitedHistory);

      // 11. Enviar respuesta por WhatsApp
      await this.sendResponse(tenantId, phoneNumber, result.content, whatsappConfig);

      // 12. Guardar mensaje saliente en BD
      await this.saveOutgoingMessage(
        tenantId,
        conversation.id,
        result.content
      );

      // 13. Actualizar conversación
      await this.updateConversation(conversation.id);

      return {
        response: result.content,
        sessionId: opencodeSessionId,
        tokensUsed: result.tokensUsed,
        toolsUsed: result.toolsUsed,
        executionTime,
      };

    } catch (error: any) {
      console.error('[WhatsAppAgentV2] Error executing message:', error);

      // Guardar mensaje de error
      await this.saveErrorMessage(tenantId, conversation.id, error.message);

      throw error;
    }
  }

  /**
   * Vincula un Agente a una configuración de WhatsApp
   */
  async linkAgent(configId: string, agentId: string, tenantId: string): Promise<void> {
    const config = await this.prisma.whatsAppConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new Error('WhatsApp config not found');
    }

    const agent = await this.prisma.agent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new Error('Agent not found');
    }

    if (agent.type !== AgentType.EXTERNAL) {
      throw new Error('Agent must be of type EXTERNAL for WhatsApp');
    }

    await this.prisma.whatsAppConfig.update({
      where: { id: configId },
      data: { agentId },
    });
  }

  /**
   * Desvincula un Agente de una configuración de WhatsApp
   */
  async unlinkAgent(configId: string, tenantId: string): Promise<void> {
    const config = await this.prisma.whatsAppConfig.findFirst({
      where: { id: configId, tenantId },
    });

    if (!config) {
      throw new Error('WhatsApp config not found');
    }

    await this.prisma.whatsAppConfig.update({
      where: { id: configId },
      data: { agentId: null },
    });
  }

  /**
   * Obtiene estadísticas de uso de WhatsApp
   */
  async getStats(tenantId: string) {
    const [activeConfigs, todayConversations, activeAgents] = await Promise.all([
      this.prisma.whatsAppConfig.count({
        where: { tenantId, isActive: true, agentId: { not: null } },
      }),
      this.prisma.conversation.count({
        where: {
          tenantId,
          status: ConversationStatus.ACTIVE,
          createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
        },
      }),
      this.prisma.agent.count({
        where: { tenantId, type: AgentType.EXTERNAL, status: 'ACTIVE' },
      }),
    ]);

    return {
      activeConfigs,
      todayConversations,
      activeAgents,
    };
  }

  // ============================================
  // Métodos Privados
  // ============================================

  /**
   * Obtiene o crea una conversación
   */
  private async getOrCreateConversation(
    tenantId: string,
    configId: string,
    phoneNumber: string,
    agentId: string
  ) {
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        tenantId_phoneNumber_configId: {
          tenantId,
          phoneNumber,
          configId,
        },
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          configId,
          agentId,
          phoneNumber,
          status: ConversationStatus.ACTIVE,
        },
      });
    }

    return conversation;
  }

  /**
   * Envía mensaje de saludo
   */
  private async sendGreetingMessage(
    tenantId: string,
    phoneNumber: string,
    greeting: string
  ): Promise<void> {
    try {
      const config = await this.prisma.whatsAppConfig.findFirst({
        where: { tenantId, isActive: true },
      });

      if (config) {
        await this.whatsappApi.sendTextMessage({
          phoneNumberId: config.phoneNumberId,
          to: phoneNumber,
          message: greeting,
          accessToken: config.accessToken,
        });
      }
    } catch (error) {
      console.error('[WhatsAppAgentV2] Error sending greeting:', error);
    }
  }

  /**
   * Construye el prompt del sistema combinando Agent + WhatsAppConfig
   */
  private buildSystemPrompt(agent: Agent, config: any): string {
    const parts: string[] = [];

    // Prompt base del agente
    if (agent.systemPrompt) {
      parts.push(agent.systemPrompt);
    }

    // Instrucciones adicionales del agente
    if (agent.instructions) {
      parts.push(agent.instructions);
    }

    // Override desde WhatsAppConfig
    if (config.agentInstructions) {
      parts.push(config.agentInstructions);
    }

    // Información del negocio si está disponible
    if (config.businessName || config.businessDescription) {
      parts.push('\n## Información del Negocio');
      if (config.businessName) parts.push(`Nombre: ${config.businessName}`);
      if (config.businessDescription) parts.push(`Descripción: ${config.businessDescription}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Verifica si se requiere aprobación humana
   */
  private async checkApprovalRequired(
    response: string,
    config: any
  ): Promise<{ required: boolean; reason?: string } | null> {
    if (!config.requireApproval) {
      return null;
    }

    // Verificar palabras clave
    if (config.approvalKeywords && config.approvalKeywords.length > 0) {
      const lowerResponse = response.toLowerCase();
      for (const keyword of config.approvalKeywords) {
        if (lowerResponse.includes(keyword.toLowerCase())) {
          return {
            required: true,
            reason: `Contiene palabra clave de aprobación: ${keyword}`,
          };
        }
      }
    }

    // Verificar umbral de confianza
    if (config.approvalThreshold) {
      // Por ahora, siempre requerir aprobación si está activado
      // En el futuro, se puede usar un modelo de clasificación
      return {
        required: true,
        reason: 'Aprobación requerida por configuración',
      };
    }

    return null;
  }

  /**
   * Crea una solicitud de aprobación pendiente
   */
  private async createPendingApproval(
    tenantId: string,
    conversationId: string,
    agentId: string,
    proposedResponse: string,
    reason: string
  ) {
    return await this.prisma.pendingResponse.create({
      data: {
        tenantId,
        conversationId,
        agentId,
        proposedResponse,
        reason,
        status: 'PENDING',
        confidence: 0.5,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutos
      },
    });
  }

  /**
   * Emite evento de aprobación pendiente (WebSocket)
   */
  private emitPendingApproval(tenantId: string, data: any): void {
    // Emitir via Socket.io si está disponible
    // Esto ya está implementado en el servicio original
    console.log(`[WhatsAppAgentV2] Emitting pending approval:`, data);
  }

  /**
   * Envía respuesta por WhatsApp
   */
  private async sendResponse(
    tenantId: string,
    phoneNumber: string,
    message: string,
    config: any
  ): Promise<void> {
    const connectionType = config.connectionType || 'CLOUD_API';

    if (connectionType === 'BAILEYS') {
      const { whatsAppBaileysService } = await import('./whatsapp-baileys.service');
      await whatsAppBaileysService.sendMessage(config.id, phoneNumber, message);
    } else {
      await this.whatsappApi.sendTextMessage({
        phoneNumberId: config.phoneNumberId,
        to: phoneNumber,
        message,
        accessToken: config.accessToken,
      });
    }
  }

  /**
   * Guarda mensaje entrante en BD
   */
  private async saveIncomingMessage(
    tenantId: string,
    conversationId: string,
    phoneNumber: string,
    content: string,
    messageId?: string
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        messageId,
        direction: 'INCOMING',
        type: 'TEXT',
        content,
        status: 'DELIVERED',
      },
    });
  }

  /**
   * Guarda mensaje saliente en BD
   */
  private async saveOutgoingMessage(
    tenantId: string,
    conversationId: string,
    content: string
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTGOING',
        type: 'TEXT',
        content,
        status: 'SENT',
      },
    });
  }

  /**
   * Guarda mensaje de error en BD
   */
  private async saveErrorMessage(
    tenantId: string,
    conversationId: string,
    error: string
  ): Promise<void> {
    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId,
        direction: 'OUTGOING',
        type: 'TEXT',
        content: `[Error: ${error}]`,
        status: 'FAILED',
      },
    });
  }

  /**
   * Actualiza datos de la conversación
   */
  private async updateConversation(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        messageCount: { increment: 1 },
      },
    });
  }

  /**
   * Procesamiento legacy para configs sin agente vinculado
   */
  private async legacyProcessMessage(
    options: ProcessMessageOptions,
    config: any
  ): Promise<AgentResponse> {
    // Usar el servicio original para backward compatibility
    const { WhatsAppAgentService } = await import('./agent.service');
    const legacyService = new WhatsAppAgentService(this.whatsappApi);
    return await legacyService.processIncomingMessage(options);
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const whatsAppAgentServiceV2 = new WhatsAppAgentServiceV2(
  new WhatsAppCloudApiService()
);
