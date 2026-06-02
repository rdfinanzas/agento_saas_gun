/**
 * WhatsAppAgentService - Servicio de Agentes de WhatsApp
 *
 * REFACTORIZADO: Ahora usa @agento/agent-core para la ejecucion de OpenCode.
 * Esto permite que los agentes de WhatsApp tengan capacidades agenticas completas
 * en modo LIMITED, incluyendo:
 * - Tools de lectura (read, glob, grep)
 * - Consulta de knowledge base
 * - Lectura de Excel/Google Sheets
 * - Búsqueda semántica con embeddings
 *
 * El modo LIMITED bloquea tools peligrosas (bash, write, execute_code, etc.)
 */

import * as path from 'path';
import { PrismaClient, WhatsAppConfig, Message, Conversation } from '@prisma/client';
import { WhatsAppCloudApiService } from './whatsapp-cloud-api.service';
import type { Server as SocketServer } from 'socket.io';

// Importar desde @agento/agent-core
import {
  WhatsAppAdapter as CoreWhatsAppAdapter,
  WhatsAppContext,
  ConversationMessage,
  AgentResponse as CoreAgentResponse,
  TenantManager,
  WorkspaceManager,
} from '@agento/agent-core';

// Importar constantes de herramientas desde el módulo opencode interno
import { LIMITED_MODE_TOOLS, FULL_MODE_TOOLS } from '../../opencode';

import { embeddingsService } from '../../memory/services/embeddings.service';

// PLAN #7: Importar servicio de decisión de aprobaciones
import { approvalDecisionService } from './approval-decision.service';

// ============================================
// Interfaces
// ============================================

export interface KnowledgeBase {
  faq?: Record<string, string>;
  products?: any[];
  policies?: Record<string, string>;
  custom?: Record<string, any>;
  businessInfo?: {
    name?: string;
    description?: string;
    hours?: string;
    location?: string;
  };
}

// Interface for embeddings results
interface EmbeddingResult {
  content: string;
  source: string;
  score: number;
}

export interface AgentResponse {
  response: string;
  confidence?: number;
  sources?: string[];
  tokensUsed?: number;
  toolsUsed?: string[];
  executionTime?: number;
  simulated?: boolean;
}

export interface ProcessMessageOptions {
  tenantId: string;
  phoneNumber: string;
  message: string;
  messageId?: string;
}

interface ExecuteParams {
  tenantId: string;
  phoneNumber: string;
  message: string;
  config: WhatsAppConfig;
  workspacePath: string;
}

// ============================================
// Servicio Principal
// ============================================

export class WhatsAppAgentService {
  private prisma: PrismaClient;
  private coreAdapter: CoreWhatsAppAdapter;
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private io: SocketServer | null = null; // PLAN #7: WebSocket instance

  constructor(
    private whatsappApi: WhatsAppCloudApiService
  ) {
    this.prisma = new PrismaClient();
    this.coreAdapter = new CoreWhatsAppAdapter();
    this.tenantManager = new TenantManager();
    this.workspaceManager = new WorkspaceManager();
  }

  // ============================================
  // Metodos Publicos
  // ============================================

  /**
   * Process incoming message and generate AI response using OpenCode
   * en modo LIMITED con capacidades agenticas
   */
  async processIncomingMessage(options: ProcessMessageOptions): Promise<AgentResponse> {
    const { tenantId, phoneNumber, message } = options;

    // 1. Get agent configuration
    const config = await this.getWhatsAppConfig(tenantId);

    if (!config || !config.isActive) {
      throw new Error('WhatsApp not configured or inactive for tenant');
    }

    // 2. Check if agent is in draft mode (sandbox)
    const isDraft = (config as any).isDraft ?? false;
    if (isDraft) {
      console.log(`[WhatsAppAgent] Agent ${tenantId} is in DRAFT mode - using simulation`);
      return this.simulateResponse(message, config);
    }

    // 3. Ensure workspace exists using agent-core
    const workspacePath = this.workspaceManager.ensureWorkspace(tenantId);

    // 4. Execute AI using OpenCode in LIMITED mode
    const response = await this.executeWithOpenCode({
      tenantId,
      phoneNumber,
      message,
      config,
      workspacePath,
    });

    // 5. PLAN #7: Verificar si requiere aprobación humana
    const conversation = await this.getOrCreateConversation(tenantId, phoneNumber);

    const approvalDecision = await approvalDecisionService.shouldRequireApproval({
      tenantId,
      conversationId: conversation.id,
      confidence: response.confidence,
      proposedResponse: response.response,
    });

    if (approvalDecision.requiresApproval) {
      console.log(`[WhatsAppAgent] Response requires approval: ${approvalDecision.reason}`);

      // Notificar via WebSocket (si está disponible)
      this.emitPendingApproval(tenantId, {
        conversationId: conversation.id,
        phoneNumber,
        pendingId: approvalDecision.pendingResponse!.id,
        preview: response.response.substring(0, 100),
        reason: approvalDecision.reason
      });

      // Retornar respuesta especial indicando aprobación pendiente
      return {
        ...response,
        requiresApproval: true,
        pendingId: approvalDecision.pendingResponse!.id,
        approvalReason: approvalDecision.reason
      } as any;
    }

    // 6. Save response to database
    await this.saveAgentResponse(tenantId, phoneNumber, response.response);

    // 7. Update usage stats
    await this.updateUsageStats(tenantId);

    return response;
  }

   /**
   * Send response message through WhatsApp
   * Supports both CLOUD_API and BAILEYS connection types
   */
  async sendResponse(tenantId: string, phoneNumber: string, message: string): Promise<void> {
    const config = await this.getWhatsAppConfig(tenantId);

    if (!config || !config.isActive) {
      throw new Error('WhatsApp not configured for tenant');
    }

    // Determine which service to use based on connectionType
    const connectionType = (config as any).connectionType || 'CLOUD_API';

    if (connectionType === 'BAILEYS') {
      // Use Baileys service - need configId, not tenantId
      const { whatsAppBaileysService } = await import('./whatsapp-baileys.service');
      const success = await whatsAppBaileysService.sendMessage(config.id, phoneNumber, message);
      
      if (!success) {
        throw new Error('Failed to send message via Baileys');
      }
    } else {
      // Use Cloud API (default)
      await this.whatsappApi.sendTextMessage({
        phoneNumberId: config.phoneNumberId,
        to: phoneNumber,
        message,
        accessToken: config.accessToken
      });
    }

    // Update message status
    await this.updateMessageStatus(tenantId, phoneNumber, 'SENT');
  }

  /**
   * Configure agent for a tenant
   */
  async configureAgent(
    tenantId: string,
    instructions: string,
    knowledgeBase: KnowledgeBase,
    whatsappConfig?: {
      phoneNumberId: string;
      accessToken: string;
      webhookVerifyToken: string;
    }
  ): Promise<WhatsAppConfig> {
    const existing = await this.prisma.whatsAppConfig.findUnique({
      where: { tenantId }
    });

    const configData = {
      agentInstructions: instructions,
      knowledgeBase: knowledgeBase as any,
      agentMode: 'LIMITED' as const,
      isActive: true
    };

    if (!existing && !whatsappConfig) {
      throw new Error('WhatsApp configuration required for first-time setup');
    }

    return await this.prisma.whatsAppConfig.upsert({
      where: { tenantId },
      create: {
        tenantId,
        phoneNumberId: whatsappConfig?.phoneNumberId || existing?.phoneNumberId || '',
        accessToken: whatsappConfig?.accessToken || existing?.accessToken || '',
        webhookVerifyToken: whatsappConfig?.webhookVerifyToken || existing?.webhookVerifyToken || '',
        ...configData
      },
      update: configData
    });
  }

  /**
   * Update knowledge base
   */
  async updateKnowledgeBase(tenantId: string, knowledgeBase: KnowledgeBase): Promise<void> {
    await this.prisma.whatsAppConfig.update({
      where: { tenantId },
      data: { knowledgeBase: knowledgeBase as any }
    });
  }

  /**
   * Get agent status
   */
  async getAgentStatus(tenantId: string) {
    const config = await this.getWhatsAppConfig(tenantId);

    if (!config) {
      return {
        isActive: false,
        mode: 'NONE',
        isDraft: false,
        hasKnowledge: false,
        phoneNumberId: null
      };
    }

    const isDraft = (config as any).isDraft ?? false;
    const agentName = (config as any).agentName ?? null;
    const agentRole = (config as any).agentRole ?? null;

    return {
      isActive: config.isActive,
      mode: config.agentMode,
      isDraft,
      hasKnowledge: !!config.knowledgeBase,
      phoneNumberId: config.phoneNumberId,
      agentName,
      agentRole
    };
  }

  /**
   * Toggle agent active status
   */
  async toggleAgent(tenantId: string, isActive: boolean): Promise<void> {
    await this.prisma.whatsAppConfig.update({
      where: { tenantId },
      data: { isActive }
    });
  }

  /**
   * Set draft/production mode
   */
  async setDraftMode(tenantId: string, isDraft: boolean): Promise<void> {
    await this.prisma.whatsAppConfig.update({
      where: { tenantId },
      data: { isDraft } as any
    });
  }

  // ============================================
  // Integración con @agento/agent-core
  // ============================================

  /**
   * Execute AI using @agento/agent-core WhatsAppAdapter
   * Incluye capacidades agenticas: tools de lectura, knowledge base, embeddings
   */
  private async executeWithOpenCode(params: ExecuteParams): Promise<AgentResponse> {
    const { tenantId, phoneNumber, message, config, workspacePath } = params;
    const startTime = Date.now();

    try {
      console.log(`[WhatsAppAgent] Executing via @agento/agent-core for tenant ${tenantId}`);

      // 1. Cargar contexto de conversación
      const conversationHistory = await this.getConversationHistory(tenantId, phoneNumber);

      // 2. Buscar embeddings relevantes
      let relevantEmbeddings: EmbeddingResult[] = [];
      try {
        const contextResult = await embeddingsService.getRelevantContext(
          tenantId,
          message,
          { maxTokens: 1500, threshold: 0.5, maxResults: 10 }
        );

        if (contextResult.totalResults > 0 && contextResult.context) {
          // Convertir contexto a embeddings para el metadata
          relevantEmbeddings = contextResult.sources.map(source => ({
            content: contextResult.context,
            source,
            score: 1.0,
          }));
          console.log(`[WhatsAppAgent] Found ${contextResult.totalResults} relevant embeddings`);
        }
      } catch (embeddingError) {
        console.log('[WhatsAppAgent] Embeddings not available, continuing without them');
      }

      // 3. Preparar tenant config para agent-core
      const knowledge = config.knowledgeBase as KnowledgeBase || {};

      // 3.1 Cargar skills instalados como herramientas dinámicas
      const { skillLoaderService } = await import('./skill-loader.service');
      const { skillWrapperService } = await import('./skill-wrapper.service');
      const skillTools = await skillLoaderService.loadSkillsAsTools(tenantId);
      const skillToolNames = skillTools.map((t) => t.name);

      console.log(`[WhatsAppAgent] Loaded ${skillTools.length} skill tools: ${skillToolNames.join(', ')}`);

      // 3.2 Crear wrappers en el workspace para que OpenCode pueda ejecutar skills
      const storagePath = process.env.AGENTO_STORAGE_PATH || path.join(process.cwd(), 'storage', 'tenants');
      const workspacePath = path.join(storagePath, tenantId, 'workspace');
      await skillWrapperService.createAllSkillWrappers(tenantId, workspacePath, skillTools);

      // 3.3 Combinar tools base con skills - LEER CONFIGURACIÓN DESDE DB
      const agentMode = config.agentMode || 'LIMITED';
      const configuredAllowedTools = (config as any).allowedTools || [];
      const configuredBlockedTools = (config as any).blockedTools || this.getDefaultBlockedTools(agentMode);

      // Si allowedTools está vacío, usar las herramientas por defecto del modo
      const baseTools = configuredAllowedTools.length > 0
        ? configuredAllowedTools
        : this.getToolsForMode(agentMode);

      // Combinar tools base con skills instalados
      const allAllowedTools = [...baseTools, ...skillToolNames];

      const tenantConfig = {
        tenantId,
        mode: agentMode,
        agentName: (config as any).agentName || 'Asistente',
        agentRole: (config as any).agentRole || 'Agente de Atención al Cliente',
        agentStyle: (config as any).agentStyle || 'amigable y profesional',
        agentLanguage: (config as any).agentLanguage || 'es',
        businessName: knowledge.businessInfo?.name || (config as any).businessName || 'Empresa',
        businessType: (config as any).businessType || 'Negocio',
        businessDescription: knowledge.businessInfo?.description || (config as any).businessDescription || '',
        businessHours: (config as any).businessHours || {},
        businessPolicies: knowledge.policies || (config as any).businessPolicies || {},
        knowledgeBase: {
          ...knowledge,
          embeddings: relevantEmbeddings.length > 0 ? relevantEmbeddings : undefined,
        },
        faq: knowledge.faq || (config as any).faq || {},
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        allowedTools: allAllowedTools,
        blockedTools: configuredBlockedTools,
        skills: skillTools, // Pasar información de skills para ejecución
      };

      // 4. Guardar configuración del tenant
      await this.tenantManager.saveConfig(tenantConfig);

      // 5. Construir contexto para WhatsAppAdapter
      const context: WhatsAppContext = {
        phoneNumber,
        contactName: undefined, // Could be fetched from DB
        conversationHistory: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
        })),
        metadata: {
          relevantEmbeddings,
          agentInstructions: config.agentInstructions,
        },
      };

      // 6. Ejecutar via @agento/agent-core
      const result = await this.coreAdapter.execute(tenantId, message, context);

      const executionTime = Date.now() - startTime;
      console.log(`[WhatsAppAgent] Execution completed in ${executionTime}ms`);
      if (result.toolsUsed && result.toolsUsed.length > 0) {
        console.log(`[WhatsAppAgent] Tools used: ${result.toolsUsed.join(', ')}`);
      }

      // 7. Procesar respuesta
      if (result.status === 'error') {
        console.error('[WhatsAppAgent] Error:', result.error);
        return this.generateFallbackResponse(message, config, executionTime);
      }

      // 8. Identificar fuentes usadas
      const sources = this.identifySources(result.content, knowledge, relevantEmbeddings);

      // 9. Calcular confianza
      const confidence = this.calculateConfidence(result.content, knowledge, relevantEmbeddings);

      return {
        response: result.content,
        confidence,
        sources,
        tokensUsed: result.tokensUsed,
        toolsUsed: result.toolsUsed,
        executionTime,
      };

    } catch (error: any) {
      console.error('[WhatsAppAgent] Error executing agent-core:', error);
      const executionTime = Date.now() - startTime;

      // Fallback
      return this.generateFallbackResponse(message, config, executionTime, error.message);
    }
  }

  /**
   * Get conversation history for context
   */
  private async getConversationHistory(
    tenantId: string,
    phoneNumber: string,
    limit: number = 20
  ): Promise<ConversationMessage[]> {
    try {
      const conversation = await this.prisma.conversation.findUnique({
        where: {
          tenantId_phoneNumber: { tenantId, phoneNumber }
        }
      });

      if (!conversation) {
        return [];
      }

      const messages = await this.prisma.message.findMany({
        where: { conversationId: conversation.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          direction: true,
          content: true,
          createdAt: true,
        },
      });

      // Invertir para tener orden cronológico
      return messages.reverse().map(m => ({
        role: m.direction === 'INCOMING' ? 'user' as const : 'assistant' as const,
        content: m.content || '',
        timestamp: m.createdAt?.toISOString(),
      }));

    } catch (error) {
      console.error('[WhatsAppAgent] Error getting conversation history:', error);
      return [];
    }
  }

  /**
   * Calculate confidence based on response content
   */
  private calculateConfidence(
    response: string,
    knowledge: KnowledgeBase,
    embeddings: EmbeddingResult[]
  ): number {
    let confidence = 0.7; // Base confidence

    // Aumentar si usó embeddings
    if (embeddings.length > 0) {
      confidence += 0.1;
    }

    // Aumentar si la respuesta contiene información de la base de conocimiento
    if (knowledge.products) {
      const productNames = knowledge.products.map((p: any) => p.name?.toLowerCase()).filter(Boolean);
      if (productNames.some((name: string) => response.toLowerCase().includes(name))) {
        confidence += 0.1;
      }
    }

    if (knowledge.businessInfo?.name && response.toLowerCase().includes(knowledge.businessInfo.name.toLowerCase())) {
      confidence += 0.05;
    }

    // Reducir si contiene indicadores de incertidumbre
    const uncertaintyPhrases = ['no se', 'no tengo informacion', 'no estoy seguro', 'disculpa', 'lo siento'];
    const lowerResponse = response.toLowerCase();
    const uncertaintyCount = uncertaintyPhrases.filter(phrase => lowerResponse.includes(phrase)).length;
    confidence -= uncertaintyCount * 0.05;

    return Math.max(0.3, Math.min(1.0, confidence));
  }

  /**
   * Identify which sources were used in the response
   */
  private identifySources(
    response: string,
    knowledge: KnowledgeBase,
    embeddings: EmbeddingResult[]
  ): string[] {
    const sources: string[] = ['opencode'];

    if (knowledge.products && knowledge.products.length > 0) {
      const productNames = knowledge.products.map((p: any) => p.name?.toLowerCase()).filter(Boolean);
      if (productNames.some((name: string) => response.toLowerCase().includes(name))) {
        sources.push('products');
      }
    }

    if (knowledge.faq && Object.keys(knowledge.faq).length > 0) {
      const faqKeys = Object.keys(knowledge.faq).map(k => k.toLowerCase());
      if (faqKeys.some(key => response.toLowerCase().includes(key))) {
        sources.push('faq');
      }
    }

    if (knowledge.businessInfo?.name && response.toLowerCase().includes(knowledge.businessInfo.name.toLowerCase())) {
      sources.push('business-info');
    }

    if (embeddings.length > 0) {
      sources.push('embeddings');
    }

    return [...new Set(sources)];
  }

  /**
   * Generate fallback response when OpenCode fails
   */
  private generateFallbackResponse(
    message: string,
    config: WhatsAppConfig,
    executionTime: number,
    error?: string
  ): AgentResponse {
    const knowledge = config.knowledgeBase as KnowledgeBase || {};
    const lowerMessage = message.toLowerCase();

    // Buscar en productos
    if (knowledge.products && Array.isArray(knowledge.products)) {
      for (const product of knowledge.products) {
        if (lowerMessage.includes(product.name?.toLowerCase() || '')) {
          return {
            response: `Si, tenemos ${product.name} disponible. ${product.price ? `Precio: ${product.price}` : ''} ${product.stock ? `Stock: ${product.stock}` : ''}`.trim(),
            confidence: 0.6,
            sources: ['fallback', 'products'],
            executionTime,
          };
        }
      }
    }

    // Buscar en FAQs
    if (knowledge.faq) {
      for (const [question, answer] of Object.entries(knowledge.faq)) {
        if (lowerMessage.includes(question.toLowerCase())) {
          return {
            response: answer as string,
            confidence: 0.7,
            sources: ['fallback', 'faq'],
            executionTime,
          };
        }
      }
    }

    // Buscar en políticas
    if (knowledge.policies) {
      for (const [key, value] of Object.entries(knowledge.policies)) {
        if (lowerMessage.includes(key.toLowerCase())) {
          return {
            response: value as string,
            confidence: 0.6,
            sources: ['fallback', 'policies'],
            executionTime,
          };
        }
      }
    }

    // Respuesta genérica
    const businessName = knowledge.businessInfo?.name || 'nuestra empresa';
    return {
      response: `Gracias por contactar a ${businessName}. En breve un agente te atenderá.`,
      confidence: 0.4,
      sources: ['fallback'],
      executionTime,
    };
  }

  /**
   * Simulate response for draft/sandbox mode
   * Ahora también usa OpenCode pero marca como simulación
   */
  private async simulateResponse(message: string, config: WhatsAppConfig): Promise<AgentResponse> {
    const knowledge = config.knowledgeBase as KnowledgeBase || {};

    // Usar respuesta fallback para simulación
    const fallbackResponse = this.generateFallbackResponse(message, config, 0);

    return {
      ...fallbackResponse,
      response: `[MODO PRUEBA] ${fallbackResponse.response}`,
      confidence: 0.5,
      sources: ['simulation'],
      simulated: true,
    };
  }

  // ============================================
  // Metodos de Base de Datos
  // ============================================

  /**
   * Get WhatsApp configuration for tenant
   */
  private async getWhatsAppConfig(tenantId: string): Promise<WhatsAppConfig | null> {
    return await this.prisma.whatsAppConfig.findUnique({
      where: { tenantId }
    });
  }

  /**
   * Save agent response to database
   */
  private async saveAgentResponse(tenantId: string, phoneNumber: string, response: string): Promise<void> {
    const conversation = await this.getOrCreateConversation(tenantId, phoneNumber);

    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        fromPhone: 'SYSTEM',
        toPhone: phoneNumber,
        direction: 'OUTGOING',
        type: 'text',
        content: response,
        status: 'SENT'
      } as any
    });

    // Actualizar lastMessageAt de la conversación
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() }
    });
  }

  /**
   * Get or create conversation
   */
  private async getOrCreateConversation(tenantId: string, phoneNumber: string): Promise<Conversation> {
    let conversation = await this.prisma.conversation.findUnique({
      where: {
        tenantId_phoneNumber: { tenantId, phoneNumber }
      }
    });

    if (!conversation) {
      const config = await this.getWhatsAppConfig(tenantId);
      if (!config) {
        throw new Error('WhatsApp config not found for tenant');
      }

      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          configId: config.id,
          phoneNumber,
          status: 'ACTIVE'
        } as any
      });
    }

    return conversation;
  }

  /**
   * Update message status
   */
  private async updateMessageStatus(tenantId: string, phoneNumber: string, status: string): Promise<void> {
    await this.prisma.message.updateMany({
      where: {
        tenantId,
        toPhone: phoneNumber,
        direction: 'OUTGOING',
      } as any,
      data: { status }
    });
  }

  /**
   * Update usage statistics
   */
  private async updateUsageStats(tenantId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.tenantUsage.upsert({
      where: {
        tenantId_date: { tenantId, date: today }
      } as any,
      create: {
        tenantId,
        date: today,
        requestsCount: 1,
        whatsappMessages: 1,
      } as any,
      update: {
        requestsCount: { increment: 1 },
        whatsappMessages: { increment: 1 },
      } as any
    });
  }

  // ============================================
  // Metodos de Health Check
  // ============================================

  /**
   * Check if OpenCode is available
   */
  async checkOpenCodeAvailability(): Promise<{
    available: boolean;
    version: string | null;
    platform: string;
    error?: string;
  }> {
    try {
      const health = await this.coreAdapter.checkAvailability();
      return {
        available: health.available,
        version: health.version || null,
        platform: `${process.platform} (${process.arch})`,
        error: health.available ? undefined : (health.error || 'OpenCode CLI not found'),
      };
    } catch (error: any) {
      return {
        available: false,
        version: null,
        platform: `${process.platform} (${process.arch})`,
        error: error.message,
      };
    }
  }

  /**
   * Check if agent is properly configured
   */
  async checkAgentHealth(tenantId: string): Promise<{
    configured: boolean;
    active: boolean;
    hasKnowledge: boolean;
    opencodeAvailable: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    const config = await this.getWhatsAppConfig(tenantId);
    const opencodeHealth = await this.checkOpenCodeAvailability();

    if (!config) {
      issues.push('WhatsApp not configured for tenant');
    }
    if (config && !config.isActive) {
      issues.push('WhatsApp agent is inactive');
    }
    if (config && !config.knowledgeBase) {
      issues.push('No knowledge base configured');
    }
    if (!opencodeHealth.available) {
      issues.push(`OpenCode not available: ${opencodeHealth.error}`);
    }

    return {
      configured: !!config,
      active: config?.isActive ?? false,
      hasKnowledge: !!(config?.knowledgeBase),
      opencodeAvailable: opencodeHealth.available,
      issues,
    };
  }

  // ============================================
  // PLAN #7: Helper Functions for Human in the Loop
  // ============================================

  /**
   * Inicializa el servicio con la instancia de Socket.io
   * Debe llamarse después de que el servidor WebSocket esté inicializado
   */
  initializeWithIO(io: SocketServer): void {
    this.io = io;
    console.log('[WhatsAppAgent] AgentService initialized with Socket.io');
  }

  /**
   * Emite evento de WebSocket cuando hay una aprobación pendiente
   * PLAN #7: Conectado al servidor WebSocket real
   */
  private emitPendingApproval(tenantId: string, data: {
    conversationId: string;
    phoneNumber: string;
    pendingId: string;
    preview: string;
    reason?: string;
  }): void {
    console.log(`[WhatsAppAgent] Emitting pending approval for tenant ${tenantId}`);

    // Emitir evento WebSocket si está disponible
    if (this.io) {
      this.io.to(`tenant:${tenantId}`).emit('pending_approval', {
        type: 'pending_approval',
        conversationId: data.conversationId,
        phoneNumber: data.phoneNumber,
        pendingId: data.pendingId,
        preview: data.preview,
        reason: data.reason,
        timestamp: new Date().toISOString()
      });
      console.log(`[WhatsAppAgent] ✓ WebSocket event emitted to tenant:${tenantId}`);
    } else {
      console.warn(`[WhatsAppAgent] ⚠ WebSocket not available, notification not sent`);
    }
  }

  // ============================================
  // PLAN #4: Helper Functions for Dynamic Config
  // ============================================

  /**
   * Obtiene las herramientas permitidas según el modo del agente
   */
  private getToolsForMode(mode: 'LIMITED' | 'FULL'): string[] {
    if (mode === 'FULL') {
      return FULL_MODE_TOOLS;
    }
    return LIMITED_MODE_TOOLS;
  }

  /**
   * Obtiene las herramientas bloqueadas por defecto según el modo
   */
  private getDefaultBlockedTools(mode: 'LIMITED' | 'FULL'): string[] {
    if (mode === 'FULL') {
      return []; // En FULL, no hay herramientas bloqueadas por defecto
    }
    return ['bash', 'write', 'edit', 'task']; // En LIMITED, estas tools están bloqueadas
  }
}

// ============================================
// PLAN #7: Singleton e Inicialización
// ============================================

/**
 * Singleton instance del WhatsAppAgentService
 */
export const whatsAppAgentService = new WhatsAppAgentService(
  new WhatsAppCloudApiService()
);

/**
 * Inicializa el WhatsAppAgentService con Socket.io
 * Debe llamarse desde server.ts después de inicializar el WebSocket
 */
export function initializeWhatsAppAgentService(io: SocketServer): void {
  whatsAppAgentService.initializeWithIO(io);
}
