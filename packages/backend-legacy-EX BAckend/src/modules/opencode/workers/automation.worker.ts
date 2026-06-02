/**
 * AutomationWorker - Worker para ejecutar automatizaciones
 * FASE 5: Automatizaciones Autónomas
 *
 * PLAN #5: Migrado a @agento/agent-core
 */

import { prisma } from '../../../config/database';
import { agentIdentityService } from '../services/agent-identity.service';
import { WhatsAppAdapter } from '@agento/agent-core';
import type { TaskType } from '../services/scheduler.service';
import { aiSummaryAutomation } from '../automation-types/ai-summary';
import { aiProactiveAutomation } from '../automation-types/ai-proactive';
import { automationAIService } from '../services/automation-ai.service';

// Declare console for global access
declare const console: {
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
  warn: (...args: any[]) => void;
};

// Interfaces
export interface AutomationJobData {
  tenantId: string;
  taskType: TaskType;
  taskConfig: Record<string, any>;
  agentId?: string;
}

export interface AutomationResult {
  success: boolean;
  message: string;
  data?: Record<string, any>;
  notificationsSent?: number;
  errors?: string[];
}

export class AutomationWorker {
  private adapter: WhatsAppAdapter;

  constructor() {
    // PLAN #5: Usar @agento/agent-core - WhatsAppAdapter maneja internamente la ejecución
    this.adapter = new WhatsAppAdapter();
  }

  /**
   * Procesa una tarea de automatización
   */
  async process(jobData: AutomationJobData): Promise<AutomationResult> {
    const { tenantId, taskType, taskConfig, agentId } = jobData;

    switch (taskType) {
      case 'stock_check':
        return this.checkStock(tenantId, taskConfig as any);

      case 'alert':
        return this.sendAlert(tenantId, taskConfig as any);

      case 'follow_up':
        return this.followUp(tenantId, taskConfig as any);

      case 'report':
        return this.generateReport(tenantId, taskConfig as any, agentId);

      case 'custom':
        return this.executeCustom(tenantId, taskConfig as any);

      // AI-powered automations
      case 'ai_daily_summary':
        return this.processAIDailySummary(tenantId, taskConfig);

      case 'ai_proactive_followup':
        return this.processAIProactiveFollowup(tenantId, taskConfig);

      case 'ai_sentiment_alert':
        return this.processAISentimentAlert(tenantId, taskConfig);

      default:
        return {
          success: false,
          message: `Tipo de tarea desconocido: ${taskType}`,
        };
    }
  }

  /**
   * Verifica niveles de stock
   */
  private async checkStock(
    tenantId: string,
    config: {
      threshold: number;
      products?: string[];
      notifyTo?: string;
    }
  ): Promise<AutomationResult> {
    try {
      // Obtener knowledge base del agente
      const agentConfig = await agentIdentityService.getIdentity(tenantId);
      const knowledgeBase = agentConfig?.knowledgeBase as any || {};

      // Buscar productos en la knowledge base
      const products = knowledgeBase.products || [];
      const lowStockProducts: any[] = [];

      for (const product of products) {
        // Filtrar por productos específicos si se configuran
        if (config.products && config.products.length > 0) {
          if (!config.products.includes(product.name) && !config.products.includes(product.id)) {
            continue;
          }
        }

        // Verificar stock
        const stock = product.stock || product.quantity || 0;
        if (stock < config.threshold) {
          lowStockProducts.push({
            name: product.name,
            sku: product.sku || product.id,
            currentStock: stock,
            threshold: config.threshold,
          });
        }
      }

      if (lowStockProducts.length === 0) {
        return {
          success: true,
          message: 'No hay productos con stock bajo',
          data: { checkedProducts: products.length },
        };
      }

      // Enviar alerta si hay productos con stock bajo
      if (config.notifyTo) {
        const alertMessage = this.formatStockAlert(lowStockProducts);
        await this.sendWhatsAppNotification(tenantId, config.notifyTo, alertMessage);
      }

      return {
        success: true,
        message: `Se encontraron ${lowStockProducts.length} productos con stock bajo`,
        data: {
          lowStockProducts,
          threshold: config.threshold,
        },
        notificationsSent: config.notifyTo ? 1 : 0,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error en verificación de stock: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Envía alertas programadas
   */
  private async sendAlert(
    tenantId: string,
    config: {
      message: string;
      recipients: string[];
      channels: ('whatsapp' | 'email')[];
    }
  ): Promise<AutomationResult> {
    const errors: string[] = [];
    let notificationsSent = 0;

    for (const recipient of config.recipients) {
      try {
        if (config.channels.includes('whatsapp')) {
          await this.sendWhatsAppNotification(tenantId, recipient, config.message);
          notificationsSent++;
        }
        // Email se implementaría con un servicio de email
      } catch (error: any) {
        errors.push(`Error enviando a ${recipient}: ${error.message}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Alerta enviada a ${notificationsSent} destinatarios`,
      notificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Realiza seguimiento a clientes
   */
  private async followUp(
    tenantId: string,
    config: {
      daysSinceLastContact: number;
      messageTemplate?: string;
      maxContacts?: number;
    }
  ): Promise<AutomationResult> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - config.daysSinceLastContact);

      // Buscar conversaciones sin actividad reciente
      const staleConversations = await prisma.conversation.findMany({
        where: {
          tenantId,
          lastMessageAt: {
            lt: cutoffDate,
          },
          status: 'ACTIVE',
        },
        take: config.maxContacts || 10,
      });

      if (staleConversations.length === 0) {
        return {
          success: true,
          message: 'No hay conversaciones para seguimiento',
          data: { checkedConversations: 0 },
        };
      }

      const errors: string[] = [];
      let notificationsSent = 0;

      for (const conversation of staleConversations) {
        try {
          const message = config.messageTemplate ||
            '¡Hola! Notamos que no hemos tenido contacto reciente. ¿En qué podemos ayudarte?';

          await this.sendWhatsAppNotification(
            tenantId,
            conversation.phoneNumber,
            message
          );
          notificationsSent++;
        } catch (error: any) {
          errors.push(`Error enviando a ${conversation.phoneNumber}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Seguimiento enviado a ${notificationsSent} contactos`,
        data: {
          contactedConversations: staleConversations.length,
          cutoffDate,
        },
        notificationsSent,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error en seguimiento: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Genera reportes
   */
  private async generateReport(
    tenantId: string,
    config: {
      type: 'daily' | 'weekly' | 'monthly';
      includeStats: boolean;
      recipients: string[];
    },
    agentId?: string
  ): Promise<AutomationResult> {
    try {
      // Calcular rango de fechas según tipo
      const now = new Date();
      let startDate = new Date();

      switch (config.type) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }

      // Recopilar estadísticas
      let stats: Record<string, any> = {};

      if (config.includeStats) {
        const conversations = await prisma.conversation.count({
          where: {
            tenantId,
            createdAt: { gte: startDate },
          },
        });

        const messages = await prisma.message.count({
          where: {
            tenantId,
            createdAt: { gte: startDate },
          },
        });

        const completedSimulations = await prisma.simulationSession.count({
          where: {
            tenantId,
            status: 'completed',
            startedAt: { gte: startDate },
          },
        });

        stats = {
          period: config.type,
          startDate,
          endDate: now,
          conversations,
          messages,
          completedSimulations,
        };
      }

      // Generar mensaje de reporte
      const reportMessage = this.formatReport(config.type, stats);

      // Enviar a destinatarios
      let notificationsSent = 0;
      const errors: string[] = [];

      for (const recipient of config.recipients) {
        try {
          await this.sendWhatsAppNotification(tenantId, recipient, reportMessage);
          notificationsSent++;
        } catch (error: any) {
          errors.push(`Error enviando a ${recipient}: ${error.message}`);
        }
      }

      return {
        success: true,
        message: `Reporte ${config.type} generado y enviado`,
        data: { stats, reportMessage },
        notificationsSent,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error generando reporte: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Ejecuta scripts personalizados
   */
  private async executeCustom(
    tenantId: string,
    config: {
      script: string;
      parameters?: Record<string, any>;
    }
  ): Promise<AutomationResult> {
    try {
      // Por seguridad, los scripts personalizados están limitados
      // a acciones predefinidas basadas en el script name
      const allowedScripts: Record<string, () => Promise<AutomationResult>> = {
        'cleanup_old_sessions': async () => {
          const result = await prisma.simulationSession.deleteMany({
            where: {
              tenantId,
              status: 'completed',
              startedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 días
            },
          });
          return {
            success: true,
            message: `Limpiadas ${result.count} sesiones antiguas`,
            data: { deletedCount: result.count },
          };
        },
        'sync_knowledge_base': async () => {
          // Placeholder para sincronización
          return {
            success: true,
            message: 'Knowledge base sincronizada',
          };
        },
      };

      const scriptExecutor = allowedScripts[config.script];

      if (!scriptExecutor) {
        return {
          success: false,
          message: `Script no permitido: ${config.script}. Scripts disponibles: ${Object.keys(allowedScripts).join(', ')}`,
        };
      }

      return await scriptExecutor();
    } catch (error: any) {
      return {
        success: false,
        message: `Error ejecutando script: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Procesa resumen diario con IA
   */
  private async processAIDailySummary(
    tenantId: string,
    config: any
  ): Promise<AutomationResult> {
    try {
      const result = await aiSummaryAutomation.execute(tenantId, config);

      return {
        success: result.success,
        message: `Resumen diario generado. Enviado a ${result.sentTo.length} destinatarios.`,
        data: {
          summary: result.summary,
          sentTo: result.sentTo,
          failed: result.failed,
          metrics: result.metrics,
        },
        notificationsSent: result.sentTo.length,
        errors: result.failed.length > 0 ? result.failed : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error en resumen diario con IA: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Procesa seguimiento proactivo con IA
   */
  private async processAIProactiveFollowup(
    tenantId: string,
    config: any
  ): Promise<AutomationResult> {
    try {
      const result = await aiProactiveAutomation.execute(tenantId, config);

      return {
        success: result.success,
        message: `Seguimiento proactivo completado. ${result.messagesSent}/${result.customersIdentified} mensajes enviados.`,
        data: {
          customersIdentified: result.customersIdentified,
          messagesGenerated: result.messagesGenerated,
          messagesSent: result.messagesSent,
          details: result.details,
        },
        notificationsSent: result.messagesSent,
        errors: result.errors.length > 0 ? result.errors : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error en seguimiento proactivo con IA: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  /**
   * Procesa alertas basadas en sentimiento con IA
   */
  private async processAISentimentAlert(
    tenantId: string,
    config: any
  ): Promise<AutomationResult> {
    try {
      const { lookbackHours = 24, minSeverity = 'medium' } = config;

      // Detect issues using AI
      const issues = await automationAIService.detectIssues(tenantId, {
        lookbackHours,
        minSeverity,
      });

      if (issues.length === 0) {
        return {
          success: true,
          message: 'No se detectaron problemas de sentimiento',
          data: { issues: [], checked: true },
        };
      }

      // Filter by severity threshold
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const minSeverityValue = severityOrder[minSeverity] ?? 2;
      const filteredIssues = issues.filter(
        issue => (severityOrder[issue.severity] ?? 3) <= minSeverityValue
      );

      if (filteredIssues.length === 0) {
        return {
          success: true,
          message: 'No se detectaron problemas que superen el umbral de severidad',
          data: { issues: filteredIssues, totalDetected: issues.length },
        };
      }

      // Send alerts to recipients
      const notificationsSent: string[] = [];
      const errors: string[] = [];

      if (config.recipients) {
        const alertMessage = this.formatSentimentAlert(filteredIssues);

        for (const recipient of config.recipients) {
          try {
            await this.sendWhatsAppNotification(tenantId, recipient, alertMessage);
            notificationsSent.push(recipient);
          } catch (error: any) {
            errors.push(`${recipient}: ${error.message}`);
          }
        }
      }

      return {
        success: errors.length === 0,
        message: `Se detectaron ${filteredIssues.length} problemas de sentimiento`,
        data: {
          issues: filteredIssues,
          totalDetected: issues.length,
        },
        notificationsSent: notificationsSent.length,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `Error en alertas de sentimiento: ${error.message}`,
        errors: [error.message],
      };
    }
  }

  // ============================================
  // Métodos auxiliares
  // ============================================

  private formatStockAlert(products: any[]): string {
    let message = '⚠️ *ALERTA DE STOCK BAJO*\n\n';
    message += 'Los siguientes productos tienen stock bajo:\n\n';

    for (const product of products) {
      message += `📦 *${product.name}*\n`;
      message += `   SKU: ${product.sku}\n`;
      message += `   Stock actual: ${product.currentStock}\n`;
      message += `   Umbral: ${product.threshold}\n\n`;
    }

    message += 'Por favor reposar estos productos.';

    return message;
  }

  private formatReport(
    type: 'daily' | 'weekly' | 'monthly',
    stats: Record<string, any>
  ): string {
    const periodNames = {
      daily: 'diario',
      weekly: 'semanal',
      monthly: 'mensual',
    };

    let message = `📊 *REPORTE ${periodNames[type].toUpperCase()}*\n\n`;

    if (stats.conversations !== undefined) {
      message += `💬 Conversaciones nuevas: ${stats.conversations}\n`;
    }

    if (stats.messages !== undefined) {
      message += `📝 Mensajes enviados: ${stats.messages}\n`;
    }

    if (stats.completedSimulations !== undefined) {
      message += `🧪 Simulaciones completadas: ${stats.completedSimulations}\n`;
    }

    message += `\n_Periodo: ${new Date(stats.startDate).toLocaleDateString('es')} - ${new Date(stats.endDate).toLocaleDateString('es')}_`;

    return message;
  }

  private formatSentimentAlert(issues: any[]): string {
    let message = '🚨 *ALERTA DE SENTIMIENTO*\n\n';
    message += 'Se detectaron los siguientes problemas:\n\n';

    for (const issue of issues) {
      const emoji = this.getSeverityEmoji(issue.severity);
      message += `${emoji} *${issue.category.toUpperCase()}*\n`;
      message += `   ${issue.description}\n`;
      message += `   Clientes afectados: ${issue.affectedCustomers}\n`;
      message += `   Tendencia: ${this.getTrendEmoji(issue.trend)} ${issue.trend}\n\n`;
    }

    message += 'Se recomienda revisar estas conversaciones y tomar acción.';

    return message;
  }

  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }

  private getTrendEmoji(trend: string): string {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '⚪';
    }
  }

  private async sendWhatsAppNotification(
    tenantId: string,
    phoneNumber: string,
    message: string
  ): Promise<void> {
    // Usar el adapter para enviar mensaje
    // Nota: Esto solo funciona si el agente está activo (no en draft)
    const config = await prisma.whatsAppConfig.findFirst({
      where: { tenantId },
    });

    if (!config || config.isDraft) {
      console.log(`[Automation] Agente en modo sandbox, no se envía mensaje a ${phoneNumber}`);
      return;
    }

    // Aquí se integraría con el servicio real de WhatsApp
    // Por ahora solo registramos
    console.log(`[Automation] Enviando notificación a ${phoneNumber}: ${message.substring(0, 50)}...`);

    // Guardar mensaje en BD
    await prisma.message.create({
      data: {
        tenantId,
        conversationId: '', // Se crearía la conversación si no existe
        fromPhone: config.phoneNumber || 'system',
        toPhone: phoneNumber,
        direction: 'OUTGOING',
        type: 'text',
        content: message,
        status: 'SENT',
      },
    });
  }
}

export const automationWorker = new AutomationWorker();
