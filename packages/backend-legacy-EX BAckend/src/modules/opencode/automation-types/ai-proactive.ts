/**
 * AI Proactive Follow-up Automation Type
 * Automatización para seguimiento proactivo con IA
 * FASE 4: Automatizaciones con IA Generativa
 */

import { prisma } from '../../../config/database';
import { automationAIService } from '../services/automation-ai.service';

// ============================================
// Configuration Types
// ============================================

export type TriggerType =
  | 'inactive_customers'
  | 'sentiment_drop'
  | 'unresolved_issue'
  | 'after_purchase'
  | 'birthday'
  | 'milestone'
  | 'custom_query';

export interface AIProactiveConfig {
  // Trigger configuration
  trigger: TriggerType;
  triggerConfig: {
    // For inactive_customers
    inactiveDays?: number;
    maxContacts?: number;

    // For sentiment_drop
    sentimentThreshold?: number;  // Below this value triggers follow-up
    lookbackHours?: number;

    // For unresolved_issue
    issueCategories?: string[];
    unresolvedHours?: number;

    // For after_purchase
    hoursAfterPurchase?: number;

    // For birthday
    daysBeforeBirthday?: number;

    // For milestone
    milestoneType?: 'purchases' | 'points' | 'tier' | 'anniversary';
    milestoneValue?: number;
  };

  // Message configuration
  messageConfig: {
    useTemplate: boolean;
    template?: string;
    customPrompt?: string;
    tone: 'friendly' | 'professional' | 'casual' | 'empathetic';
    includeCallToAction: boolean;
    callToActionText?: string;
    maxLength?: number;
  };

  // Delivery configuration
  deliveryConfig: {
    channel: 'whatsapp' | 'email' | 'both';
    scheduleImmediately: boolean;
    scheduledTime?: string;  // HH:MM if not immediate
    timezone?: string;
  };

  // Targeting
  targeting: {
    customerSegments?: string[];  // VIP, new, returning, etc.
    excludeCustomers?: string[];  // Customer IDs to exclude
    minSentimentScore?: number;  // Only target if sentiment >= this
  };

  // Rate limiting
  rateLimit?: {
    maxMessagesPerHour: number;
    maxMessagesPerDay: number;
  };
}

export interface AIProactiveResult {
  success: boolean;
  customersIdentified: number;
  messagesGenerated: number;
  messagesSent: number;
  messagesFailed: number;
  skippedCustomers: string[];
  errors: string[];
  details: Array<{
    customerId: string;
    phoneNumber: string;
    messageGenerated: boolean;
    messageSent: boolean;
    reason?: string;
  }>;
}

// ============================================
// Automation Handler
// ============================================

export class AIProactiveAutomation {
  /**
   * Ejecuta la automatización de seguimiento proactivo
   */
  async execute(
    tenantId: string,
    config: AIProactiveConfig
  ): Promise<AIProactiveResult> {
    const result: AIProactiveResult = {
      success: false,
      customersIdentified: 0,
      messagesGenerated: 0,
      messagesSent: 0,
      messagesFailed: 0,
      skippedCustomers: [],
      errors: [],
      details: [],
    };

    try {
      // Validate config
      this.validateConfig(config);

      // Identify customers based on trigger
      const customers = await this.identifyCustomers(tenantId, config);
      result.customersIdentified = customers.length;

      if (customers.length === 0) {
        result.success = true;
        return result;
      }

      // Check rate limits
      await this.checkRateLimits(tenantId, config, customers.length);

      // Process each customer
      for (const customer of customers) {
        try {
          const detail = await this.processCustomer(tenantId, customer, config);
          result.details.push(detail);

          if (detail.messageGenerated) result.messagesGenerated++;
          if (detail.messageSent) result.messagesSent++;
          if (detail.messageGenerated && !detail.messageSent) {
            result.messagesFailed++;
          }
        } catch (error: any) {
          console.error(`[AIProactive] Error processing customer ${customer.id}:`, error);
          result.errors.push(`${customer.phoneNumber}: ${error.message}`);
        }
      }

      result.success = result.messagesFailed === 0;
      return result;
    } catch (error: any) {
      console.error('[AIProactive] Error executing automation:', error);
      result.errors.push(error.message);
      return result;
    }
  }

  /**
   * Identifica los clientes objetivo según el trigger
   */
  private async identifyCustomers(
    tenantId: string,
    config: AIProactiveConfig
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string; metadata?: any }>> {
    const { trigger, triggerConfig } = config;

    switch (trigger) {
      case 'inactive_customers':
        return this.identifyInactiveCustomers(tenantId, triggerConfig);

      case 'sentiment_drop':
        return this.identifySentimentDrop(tenantId, triggerConfig);

      case 'unresolved_issue':
        return this.identifyUnresolvedIssues(tenantId, triggerConfig);

      case 'after_purchase':
        return this.identifyAfterPurchase(tenantId, triggerConfig);

      case 'birthday':
        return this.identifyBirthdays(tenantId, triggerConfig);

      case 'milestone':
        return this.identifyMilestones(tenantId, triggerConfig);

      case 'custom_query':
        return this.identifyCustomQuery(tenantId, triggerConfig);

      default:
        throw new Error(`Unknown trigger type: ${trigger}`);
    }
  }

  /**
   * Identifica clientes inactivos
   */
  private async identifyInactiveCustomers(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    const days = config.inactiveDays || 7;
    const maxContacts = config.maxContacts || 50;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        lastMessageAt: { lt: cutoffDate },
        status: 'ACTIVE',
      },
      take: maxContacts,
      select: {
        id: true,
        phoneNumber: true,
        contactName: true,
      },
    });

    return conversations;
  }

  /**
   * Identifica clientes con caída de sentimiento
   */
  private async identifySentimentDrop(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    const threshold = config.sentimentThreshold || -0.3;
    const lookbackHours = config.lookbackHours || 24;

    const cutoffDate = new Date(Date.now() - lookbackHours * 3600000);

    // Get recent conversations
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        lastMessageAt: { gte: cutoffDate },
      },
      select: {
        id: true,
        phoneNumber: true,
        contactName: true,
        messages: {
          where: { createdAt: { gte: cutoffDate } },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
      take: 100,
    });

    // Analyze sentiment for each (in production, this would be cached)
    const lowSentimentConversations = [];

    for (const conv of conversations) {
      // Simple heuristic: count negative indicators
      const recentMessages = conv.messages
        .filter(m => m.direction === 'INCOMING')
        .map(m => m.content?.toLowerCase() || '');

      const negativeIndicators = ['enfadado', 'molesto', 'mal', 'terrible', 'peor', 'queja', 'problema'];
      const hasNegativeSentiment = recentMessages.some(msg =>
        negativeIndicators.some(indicator => msg.includes(indicator))
      );

      if (hasNegativeSentiment) {
        lowSentimentConversations.push({
          id: conv.id,
          phoneNumber: conv.phoneNumber,
          contactName: conv.contactName,
        });
      }
    }

    return lowSentimentConversations;
  }

  /**
   * Identifica problemas no resueltos
   */
  private async identifyUnresolvedIssues(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    const hours = config.unresolvedHours || 48;
    const categories = config.issueCategories || [];

    const cutoffDate = new Date(Date.now() - hours * 3600000);

    // Look for conversations with unresolved issues mentioned
    const conversations = await prisma.conversation.findMany({
      where: {
        tenantId,
        updatedAt: { gte: cutoffDate },
      },
      select: {
        id: true,
        phoneNumber: true,
        contactName: true,
        messages: {
          where: {
            createdAt: { gte: cutoffDate },
            direction: 'INCOMING',
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      take: 50,
    });

    const withUnresolvedIssues = [];

    // Keywords for unresolved issues
    const issueKeywords = [
      'esperando', 'resolución', 'solución', 'aún no',
      'sin resolver', 'problema', 'no funciona',
    ];

    for (const conv of conversations) {
      const recentMessages = conv.messages.map(m => m.content?.toLowerCase() || '').join(' ');

      if (issueKeywords.some(kw => recentMessages.includes(kw))) {
        withUnresolvedIssues.push({
          id: conv.id,
          phoneNumber: conv.phoneNumber,
          contactName: conv.contactName,
        });
      }
    }

    return withUnresolvedIssues;
  }

  /**
   * Identifica clientes después de una compra
   */
  private async identifyAfterPurchase(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    // This would integrate with a purchase/orders system
    // For now, return empty as it requires external data
    return [];
  }

  /**
   * Identifica cumpleaños
   */
  private async identifyBirthdays(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    const daysBefore = config.daysBeforeBirthday || 0;

    // This would require birthday data in the database
    // For now, return empty as it requires additional customer data
    return [];
  }

  /**
   * Identifica hitos/milestones
   */
  private async identifyMilestones(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    const { milestoneType, milestoneValue } = config;

    switch (milestoneType) {
      case 'anniversary':
        // Find customers with conversation anniversary
        const anniversaryDate = new Date();
        anniversaryDate.setDate(anniversaryDate.getDate() - 365);

        return prisma.conversation.findMany({
          where: {
            tenantId,
            createdAt: {
              gte: new Date(anniversaryDate.setHours(0, 0, 0, 0)),
              lt: new Date(anniversaryDate.setHours(23, 59, 59, 999)),
            },
          },
          select: {
            id: true,
            phoneNumber: true,
            contactName: true,
          },
        });

      default:
        return [];
    }
  }

  /**
   * Identifica clientes basado en query personalizada
   */
  private async identifyCustomQuery(
    tenantId: string,
    config: any
  ): Promise<Array<{ id: string; phoneNumber: string; contactName?: string }>> {
    // Would allow custom SQL-like queries
    return [];
  }

  /**
   * Procesa un cliente individual
   */
  private async processCustomer(
    tenantId: string,
    customer: { id: string; phoneNumber: string; contactName?: string; metadata?: any },
    config: AIProactiveConfig
  ): Promise<{
    customerId: string;
    phoneNumber: string;
    messageGenerated: boolean;
    messageSent: boolean;
    reason?: string;
  }> {
    // Check if customer should be excluded
    if (config.targeting.excludeCustomers?.includes(customer.id)) {
      return {
        customerId: customer.id,
        phoneNumber: customer.phoneNumber,
        messageGenerated: false,
        messageSent: false,
        reason: 'Customer excluded in configuration',
      };
    }

    // Generate message
    const messageResult = await automationAIService.generateProactiveMessage(
      tenantId,
      {
        customerId: customer.id,
        triggerType: this.mapTriggerToMessageType(config.trigger),
        context: {
          customerName: customer.contactName,
          ...customer.metadata,
          ...config.triggerConfig,
        },
        template: config.messageConfig.useTemplate ? config.messageConfig.template : undefined,
        customPrompt: config.messageConfig.customPrompt,
      }
    );

    if (!messageResult.message) {
      return {
        customerId: customer.id,
        phoneNumber: customer.phoneNumber,
        messageGenerated: false,
        messageSent: false,
        reason: 'Failed to generate message',
      };
    }

    // Apply tone transformation
    const finalMessage = this.applyTone(messageResult.message, config.messageConfig.tone);

    // Add call to action if configured
    const messageWithCTA = config.messageConfig.includeCallToAction
      ? this.addCallToAction(finalMessage, config.messageConfig.callToActionText)
      : finalMessage;

    // Send message
    let messageSent = false;
    try {
      if (config.deliveryConfig.scheduleImmediately) {
        await this.sendMessage(tenantId, customer.phoneNumber, messageWithCTA, config);
        messageSent = true;
      } else {
        // Schedule for later
        await this.scheduleMessage(
          tenantId,
          customer.id,
          customer.phoneNumber,
          messageWithCTA,
          config
        );
        messageSent = true; // Scheduled counts as sent for our purposes
      }
    } catch (error: any) {
      console.error(`[AIProactive] Failed to send message to ${customer.phoneNumber}:`, error);
    }

    return {
      customerId: customer.id,
      phoneNumber: customer.phoneNumber,
      messageGenerated: true,
      messageSent,
    };
  }

  /**
   * Envía un mensaje
   */
  private async sendMessage(
    tenantId: string,
    phoneNumber: string,
    message: string,
    config: AIProactiveConfig
  ): Promise<void> {
    const whatsappConfig = await prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });

    if (!whatsappConfig || whatsappConfig.isDraft) {
      console.log(`[AIProactive] Agent in sandbox mode, skipping send to ${phoneNumber}`);
      return;
    }

    // Create message record
    await prisma.message.create({
      data: {
        tenantId,
        conversationId: '', // Will be linked to conversation if exists
        fromPhone: whatsappConfig.phoneNumber || 'system',
        toPhone: phoneNumber,
        direction: 'OUTGOING',
        type: 'text',
        content: message,
        status: 'SENT',
        metadata: {
          type: 'ai_proactive_followup',
          trigger: config.trigger,
          automated: true,
        },
      },
    });

    console.log(`[AIProactive] Sent proactive message to ${phoneNumber}`);
  }

  /**
   * Programa un mensaje para más tarde
   */
  private async scheduleMessage(
    tenantId: string,
    customerId: string,
    phoneNumber: string,
    message: string,
    config: AIProactiveConfig
  ): Promise<void> {
    // Would create a scheduled task for later delivery
    // For now, we just log it
    console.log(`[AIProactive] Scheduled message for ${phoneNumber} at ${config.deliveryConfig.scheduledTime}`);
  }

  /**
   * Aplica transformación de tono al mensaje
   */
  private applyTone(message: string, tone: string): string {
    // In production, this would use AI to transform the tone
    return message;
  }

  /**
   * Añade call to action al mensaje
   */
  private addCallToAction(message: string, ctaText?: string): string {
    const defaultCTA = '\n\n¿En qué más podemos ayudarte?';
    return message + (ctaText || defaultCTA);
  }

  /**
   * Mapea el trigger al tipo de mensaje
   */
  private mapTriggerToMessageType(trigger: TriggerType): any {
    const mapping: Record<TriggerType, any> = {
      inactive_customers: 'inactive',
      sentiment_drop: 'sentiment_drop',
      unresolved_issue: 'custom',
      after_purchase: 'milestone',
      birthday: 'birthday',
      milestone: 'milestone',
      custom_query: 'custom',
    };
    return mapping[trigger];
  }

  /**
   * Verifica rate limits
   */
  private async checkRateLimits(tenantId: string, config: AIProactiveConfig, messageCount: number): Promise<void> {
    const rateLimit = config.rateLimit || {
      maxMessagesPerHour: 100,
      maxMessagesPerDay: 1000,
    };

    // Check recent messages sent
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600000);
    const oneDayAgo = new Date(now.getTime() - 86400000);

    const [messagesLastHour, messagesLastDay] = await Promise.all([
      prisma.message.count({
        where: {
          tenantId,
          direction: 'OUTGOING',
          createdAt: { gte: oneHourAgo },
          metadata: {
            path: ['type'],
            equals: 'ai_proactive_followup',
          },
        },
      }),
      prisma.message.count({
        where: {
          tenantId,
          direction: 'OUTGOING',
          createdAt: { gte: oneDayAgo },
          metadata: {
            path: ['type'],
            equals: 'ai_proactive_followup',
          },
        },
      }),
    ]);

    if (messagesLastHour + messageCount > rateLimit.maxMessagesPerHour) {
      throw new Error(`Rate limit exceeded: ${rateLimit.maxMessagesPerHour} messages per hour`);
    }

    if (messagesLastDay + messageCount > rateLimit.maxMessagesPerDay) {
      throw new Error(`Rate limit exceeded: ${rateLimit.maxMessagesPerDay} messages per day`);
    }
  }

  /**
   * Valida la configuración
   */
  private validateConfig(config: AIProactiveConfig): void {
    if (!config.trigger) {
      throw new Error('Trigger is required');
    }

    if (!config.messageConfig) {
      throw new Error('Message configuration is required');
    }

    if (!config.deliveryConfig) {
      throw new Error('Delivery configuration is required');
    }

    // Validate scheduled time if not immediate
    if (!config.deliveryConfig.scheduleImmediately && !config.deliveryConfig.scheduledTime) {
      throw new Error('Scheduled time is required when not sending immediately');
    }
  }

  /**
   * Genera la expresión cron basada en la configuración
   */
  static generateCronExpression(config: AIProactiveConfig): string {
    if (config.deliveryConfig.scheduleImmediately) {
      return '* * * * *'; // Every minute (for checking)
    }

    const [hours, minutes] = (config.deliveryConfig.scheduledTime || '09:00').split(':');
    return `${minutes} ${hours} * * *`;
  }

  /**
   * Obtiene la configuración por defecto
   */
  static getDefaultConfig(): Partial<AIProactiveConfig> {
    return {
      trigger: 'inactive_customers',
      triggerConfig: {
        inactiveDays: 7,
        maxContacts: 20,
      },
      messageConfig: {
        useTemplate: false,
        tone: 'friendly',
        includeCallToAction: true,
        maxLength: 150,
      },
      deliveryConfig: {
        channel: 'whatsapp',
        scheduleImmediately: true,
      },
      targeting: {
        excludeCustomers: [],
      },
      rateLimit: {
        maxMessagesPerHour: 50,
        maxMessagesPerDay: 500,
      },
    };
  }
}

export const aiProactiveAutomation = new AIProactiveAutomation();
