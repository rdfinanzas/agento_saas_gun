/**
 * Internal Chat Service - Chat web para agentes internos
 *
 * Permite a los usuarios chatear con agentes internos a través de la web.
 * Cada usuario tiene su propia sesión con cada agente.
 *
 * NOTA: Por ahora usa el WhatsAppAdapter internamente con un contexto modificado.
 * En el futuro se puede crear un InternalChatAdapter específico.
 */

import { PrismaClient, Agent, AgentType } from '@prisma/client';
import { redisSessionService } from '../../sessions/services/redis-session.service';
import { WhatsAppAdapter, WhatsAppContext, ConversationMessage } from '@agento/agent-core';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

// ============================================
// Interfaces
// ============================================

export interface SendMessageOptions {
  tenantId: string;
  agentId: string;
  userId: string;
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  response: string;
  sessionId: string;
  tokensUsed?: number;
  toolsUsed?: string[];
  executionTime?: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// ============================================
// Servicio Principal
// ============================================

export class InternalChatService {
  private prisma: PrismaClient;
  private redis: typeof redisSessionService;
  private adapters: Map<string, WhatsAppAdapter> = new Map();
  private conversations: Map<string, ConversationMessage[]> = new Map();

  constructor() {
    this.prisma = prisma;
    this.redis = redisSessionService;
  }

  /**
   * Envía un mensaje a un agente interno y obtiene la respuesta
   */
  async sendMessage(options: SendMessageOptions): Promise<ChatResponse> {
    const { tenantId, agentId, userId, message, conversationId } = options;

    // 1. Verificar que el agente existe y es del tipo correcto
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: agentId,
        tenantId,
        type: AgentType.INTERNAL,
        status: 'ACTIVE',
      },
    });

    if (!agent) {
      throw new Error('Agent not found or not active');
    }

    // 2. Obtener o crear la sesión en Redis
    const sessionKey = `${tenantId}:${agentId}:${userId}`;
    let sessionData = await this.redis.get(tenantId, agentId, userId);

    let opencodeSessionId: string;
    let conversationHistory: ConversationMessage[] = [];

    if (!sessionData) {
      // Crear nueva sesión
      opencodeSessionId = `int_${tenantId}_${agentId}_${userId}_${Date.now()}`;
      conversationHistory = [];

      // Guardar en Redis
      await this.redis.set(
        tenantId,
        agentId,
        userId,
        opencodeSessionId,
        'INTERNAL',
        { ttl: 60 * 30 } // 30 minutos
      );
    } else {
      opencodeSessionId = sessionData.opencodeSessionId;
      conversationHistory = this.conversations.get(sessionKey) || [];
      // Actualizar última actividad
      await this.redis.touch(tenantId, agentId, userId);
    }

    // 3. Agregar mensaje del usuario al historial
    const userMessage: ConversationMessage = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString(),
    };
    conversationHistory.push(userMessage);

    // 4. Obtener o crear el adaptador
    let adapter = this.adapters.get(sessionKey);
    if (!adapter) {
      adapter = new WhatsAppAdapter();
      this.adapters.set(sessionKey, adapter);
    }

    // 5. Construir el contexto del agente
    const agentContext: WhatsAppContext = {
      phoneNumber: `user_${userId}`, // Usar userId como identificador
      contactName: `Usuario ${userId.substring(0, 8)}`,
      conversationHistory,
      metadata: {
        agentId,
        agentName: agent.name,
        agentRole: agent.role,
        agentStyle: agent.style,
        isInternalChat: true,
        userId,
      },
    };

    // 6. Ejecutar el mensaje
    const startTime = Date.now();

    try {
      const result = await adapter.execute(tenantId, message, agentContext);

      const executionTime = Date.now() - startTime;

      // 7. Agregar respuesta al historial
      if (result.content) {
        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content: result.content,
          timestamp: new Date().toISOString(),
        };
        conversationHistory.push(assistantMessage);
      }

      // Guardar historial actualizado (limitar a últimos 20 mensajes)
      const limitedHistory = conversationHistory.slice(-20);
      this.conversations.set(sessionKey, limitedHistory);

      return {
        response: result.content,
        sessionId: opencodeSessionId,
        tokensUsed: result.tokensUsed,
        toolsUsed: result.toolsUsed,
        executionTime,
      };

    } catch (error: any) {
      console.error('[InternalChat] Error executing message:', error);
      throw new Error(`Error executing message: ${error.message}`);
    }
  }

  /**
   * Obtiene el historial de chat de una sesión
   */
  async getChatHistory(
    tenantId: string,
    agentId: string,
    userId: string
  ): Promise<ChatMessage[]> {
    const sessionKey = `${tenantId}:${agentId}:${userId}`;
    const conversationHistory = this.conversations.get(sessionKey);

    if (!conversationHistory) {
      return [];
    }

    return conversationHistory.map((msg, idx) => ({
      id: `msg_${sessionKey}_${idx}`,
      role: msg.role,
      content: msg.content,
      timestamp: new Date(msg.timestamp || Date.now()).getTime(),
    }));
  }

  /**
   * Cierra una sesión de chat
   */
  async closeSession(
    tenantId: string,
    agentId: string,
    userId: string
  ): Promise<void> {
    const sessionKey = `${tenantId}:${agentId}:${userId}`;

    // Eliminar de Redis
    await this.redis.delete(tenantId, agentId, userId);

    // Limpiar conversación en memoria
    this.conversations.delete(sessionKey);

    // Limpiar adaptador
    const adapter = this.adapters.get(sessionKey);
    if (adapter) {
      this.adapters.delete(sessionKey);
    }
  }

  /**
   * Cierra todas las sesiones de un usuario
   */
  async closeUserSessions(tenantId: string, userId: string): Promise<void> {
    const sessions = await this.redis.getTenantSessions(tenantId);

    for (const session of sessions) {
      if (session.identifier === userId && session.agentType === 'INTERNAL') {
        await this.closeSession(session.tenantId, session.agentId, userId);
      }
    }
  }

  /**
   * Verifica si un usuario tiene una sesión activa con un agente
   */
  async hasActiveSession(
    tenantId: string,
    agentId: string,
    userId: string
  ): Promise<boolean> {
    return await this.redis.exists(tenantId, agentId, userId);
  }

  /**
   * Obtiene información de una sesión
   */
  async getSessionInfo(
    tenantId: string,
    agentId: string,
    userId: string
  ): Promise<{ sessionId: string; createdAt: number; lastActivity: number } | null> {
    const sessionData = await this.redis.get(tenantId, agentId, userId);

    if (!sessionData) {
      return null;
    }

    return {
      sessionId: sessionData.opencodeSessionId,
      createdAt: sessionData.createdAt,
      lastActivity: sessionData.lastActivity,
    };
  }

  /**
   * Obtiene todas las sesiones activas de un usuario
   */
  async getUserActiveSessions(tenantId: string, userId: string): Promise<Array<{
    agentId: string;
    sessionId: string;
    lastActivity: number;
  }>> {
    const sessions = await this.redis.getTenantSessions(tenantId);

    return sessions
      .filter(s => s.identifier === userId && s.agentType === 'INTERNAL')
      .map(s => ({
        agentId: s.agentId,
        sessionId: s.opencodeSessionId,
        lastActivity: s.lastActivity,
      }));
  }
}

// ============================================
// Instancia Singleton
// ============================================

export const internalChatService = new InternalChatService();
