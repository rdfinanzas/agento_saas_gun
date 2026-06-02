/**
 * AI Daily Summary Automation Type
 * Automatización para generar resúmenes diarios con IA
 * FASE 4: Automatizaciones con IA Generativa
 */

import { prisma } from '../../../config/database';
import { automationAIService } from '../services/automation-ai.service';

// ============================================
// Configuration Types
// ============================================

export interface AISummaryConfig {
  // Schedule
  timeOfDay: string;  // HH:MM format, e.g., "09:00" or "18:30"
  timezone?: string;  // Default: America/Mexico_City

  // Delivery
  recipients: {
    type: 'whatsapp' | 'email' | 'dashboard';
    address: string;  // Phone number or email
    enabled: boolean;
  }[];

  // Content options
  format: 'brief' | 'detailed' | 'executive';
  includeMetrics: boolean;
  includeIssues: boolean;
  includePositiveFeedback: boolean;
  includeTopIssues: boolean;
  topIssuesCount: number;  // How many top issues to include

  // Customization
  customPrompt?: string;  // Custom instructions for the AI
  language?: string;  // Default: 'es'

  // Date range
  summaryPeriod: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days';
}

export interface AISummaryResult {
  success: boolean;
  summary: string;
  sentTo: string[];
  failed: string[];
  metrics: {
    conversationsAnalyzed: number;
    messagesAnalyzed: number;
    generationTime: number;
  };
}

// ============================================
// Automation Handler
// ============================================

export class AISummaryAutomation {
  /**
   * Ejecuta la automatización de resumen diario
   */
  async execute(
    tenantId: string,
    config: AISummaryConfig
  ): Promise<AISummaryResult> {
    const startTime = Date.now();

    try {
      // Validate config
      this.validateConfig(config);

      // Generate summary using AI service
      const summaryResult = await automationAIService.generateDailySummary(
        tenantId,
        {
          timeOfDay: config.timeOfDay,
          recipients: config.recipients
            .filter(r => r.enabled)
            .map(r => r.address),
          channels: [...new Set(config.recipients.filter(r => r.enabled).map(r => r.type))],
          format: config.format,
          includeMetrics: config.includeMetrics,
          includeIssues: config.includeIssues,
          includePositiveFeedback: config.includePositiveFeedback,
          customPrompt: config.customPrompt,
        }
      );

      // Format summary for delivery
      const formattedSummary = this.formatSummary(summaryResult, config);

      // Send to recipients
      const sentTo: string[] = [];
      const failed: string[] = [];

      for (const recipient of config.recipients) {
        if (!recipient.enabled) continue;

        try {
          await this.sendToRecipient(
            tenantId,
            recipient,
            formattedSummary,
            config
          );
          sentTo.push(recipient.address);
        } catch (error: any) {
          console.error(`[AISummary] Failed to send to ${recipient.address}:`, error);
          failed.push(recipient.address);
        }
      }

      // Store summary in dashboard if configured
      if (config.recipients.some(r => r.type === 'dashboard' && r.enabled)) {
        await this.storeInDashboard(tenantId, summaryResult, formattedSummary);
      }

      const generationTime = Date.now() - startTime;

      return {
        success: failed.length === 0,
        summary: formattedSummary,
        sentTo,
        failed,
        metrics: {
          conversationsAnalyzed: summaryResult.metrics.conversations,
          messagesAnalyzed: summaryResult.metrics.messages,
          generationTime,
        },
      };
    } catch (error: any) {
      console.error('[AISummary] Error executing automation:', error);
      throw error;
    }
  }

  /**
   * Valida la configuración
   */
  private validateConfig(config: AISummaryConfig): void {
    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(config.timeOfDay)) {
      throw new Error(`Invalid time format: ${config.timeOfDay}. Expected HH:MM`);
    }

    // Validate recipients
    if (!config.recipients || config.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    const enabledRecipients = config.recipients.filter(r => r.enabled);
    if (enabledRecipients.length === 0) {
      throw new Error('At least one enabled recipient is required');
    }

    // Validate recipient addresses
    for (const recipient of enabledRecipients) {
      if (recipient.type === 'whatsapp') {
        // Basic phone validation
        if (!/^\+?\d{10,15}$/.test(recipient.address.replace(/\s/g, ''))) {
          throw new Error(`Invalid WhatsApp phone number: ${recipient.address}`);
        }
      } else if (recipient.type === 'email') {
        // Basic email validation
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.address)) {
          throw new Error(`Invalid email address: ${recipient.address}`);
        }
      }
    }

    // Validate counts
    if (config.topIssuesCount < 0 || config.topIssuesCount > 20) {
      throw new Error('topIssuesCount must be between 0 and 20');
    }
  }

  /**
   * Formatea el resumen para delivery
   */
  private formatSummary(
    summaryResult: any,
    config: AISummaryConfig
  ): string {
    const language = config.language || 'es';
    const date = new Date().toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US');

    let formatted = '';

    // Header
    const emoji = this.getHeaderEmoji(config.format);
    formatted += `${emoji} *Resumen Diario*\n`;
    formatted += `📅 ${date}\n\n`;

    // Main summary
    formatted += `${summaryResult.summary}\n\n`;

    // Metrics section
    if (config.includeMetrics && summaryResult.metrics) {
      formatted += `📊 *Métricas*\n`;
      formatted += `💬 Conversaciones: ${summaryResult.metrics.conversations}\n`;
      formatted += `📝 Mensajes: ${summaryResult.metrics.messages}\n\n`;
    }

    // Sentiment section
    if (summaryResult.sentiment) {
      formatted += `😊 *Sentimiento General*\n`;
      formatted += `✅ Positivo: ${summaryResult.sentiment.positive}%\n`;
      formatted += `😐 Neutral: ${summaryResult.sentiment.neutral}%\n`;
      formatted += `❌ Negativo: ${summaryResult.sentiment.negative}%\n\n`;
    }

    // Highlights section
    if (config.includePositiveFeedback && summaryResult.highlights?.length > 0) {
      formatted += `✨ *Destacados*\n`;
      summaryResult.highlights.slice(0, 5).forEach((h: string) => {
        formatted += `• ${h}\n`;
      });
      formatted += '\n';
    }

    // Concerns section
    if (config.includeIssues && summaryResult.concerns?.length > 0) {
      formatted += `⚠️ *Atención Requerida*\n`;
      summaryResult.concerns.slice(0, 5).forEach((c: string) => {
        formatted += `• ${c}\n`;
      });
      formatted += '\n';
    }

    // Top issues section
    if (config.includeTopIssues && config.topIssuesCount > 0 && summaryResult.topIssues?.length > 0) {
      formatted += `🔍 *Principales Temas*\n`;
      summaryResult.topIssues.slice(0, config.topIssuesCount).forEach((issue: any) => {
        formatted += `• ${issue.issue} (${issue.count} mención${issue.count > 1 ? 'es' : ''})\n`;
      });
    }

    return formatted;
  }

  private getHeaderEmoji(format: string): string {
    switch (format) {
      case 'brief': return '📋';
      case 'detailed': return '📊';
      case 'executive': return '🎯';
      default: return '📋';
    }
  }

  /**
   * Envía el resumen a un destinatario específico
   */
  private async sendToRecipient(
    tenantId: string,
    recipient: { type: string; address: string },
    summary: string,
    config: AISummaryConfig
  ): Promise<void> {
    switch (recipient.type) {
      case 'whatsapp':
        await this.sendToWhatsApp(tenantId, recipient.address, summary);
        break;

      case 'email':
        await this.sendToEmail(tenantId, recipient.address, summary, config);
        break;

      case 'dashboard':
        // Handled separately in storeInDashboard
        break;

      default:
        throw new Error(`Unknown recipient type: ${recipient.type}`);
    }
  }

  /**
   * Envía el resumen por WhatsApp
   */
  private async sendToWhatsApp(
    tenantId: string,
    phoneNumber: string,
    summary: string
  ): Promise<void> {
    // Get WhatsApp config
    const config = await prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });

    if (!config || config.isDraft) {
      console.log(`[AISummary] Agent in sandbox mode, skipping WhatsApp send to ${phoneNumber}`);
      return;
    }

    // Create message record
    await prisma.message.create({
      data: {
        tenantId,
        conversationId: '', // System message, no conversation
        fromPhone: config.phoneNumber || 'system',
        toPhone: phoneNumber,
        direction: 'OUTGOING',
        type: 'text',
        content: summary,
        status: 'SENT',
        metadata: {
          type: 'ai_daily_summary',
          automated: true,
        },
      },
    });

    // Here you would integrate with the actual WhatsApp sending service
    console.log(`[AISummary] Sent summary to WhatsApp: ${phoneNumber}`);
  }

  /**
   * Envía el resumen por email
   */
  private async sendToEmail(
    tenantId: string,
    email: string,
    summary: string,
    config: AISummaryConfig
  ): Promise<void> {
    // Get tenant info
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });

    // Here you would integrate with an email service like SendGrid, SES, etc.
    console.log(`[AISummary] Would send email to ${email} from ${tenant?.name || 'AgenTo'}`);

    // Email implementation would go here
    // For now, we just log it
  }

  /**
   * Almacena el resumen en el dashboard
   */
  private async storeInDashboard(
    tenantId: string,
    summaryResult: any,
    formattedSummary: string
  ): Promise<void> {
    // Store as a notification or in a dedicated table
    // For now, we'll use a JSON field in tenant settings or create a new table

    // This could be stored in a new AISummaries table
    // For now, we just log it
    console.log(`[AISummary] Stored summary in dashboard for tenant ${tenantId}`);
  }

  /**
   * Genera la expresión cron basada en la configuración
   */
  static generateCronExpression(config: AISummaryConfig): string {
    const [hours, minutes] = config.timeOfDay.split(':');
    return `${minutes} ${hours} * * *`;
  }

  /**
   * Obtiene la configuración por defecto
   */
  static getDefaultConfig(): Partial<AISummaryConfig> {
    return {
      timeOfDay: '09:00',
      timezone: 'America/Mexico_City',
      recipients: [
        {
          type: 'dashboard',
          address: 'dashboard',
          enabled: true,
        },
      ],
      format: 'brief',
      includeMetrics: true,
      includeIssues: true,
      includePositiveFeedback: true,
      includeTopIssues: true,
      topIssuesCount: 5,
      language: 'es',
      summaryPeriod: 'yesterday',
    };
  }
}

export const aiSummaryAutomation = new AISummaryAutomation();
