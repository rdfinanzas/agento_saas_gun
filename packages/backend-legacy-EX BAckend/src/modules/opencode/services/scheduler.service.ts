/**
 * SchedulerService - Sistema de tareas programadas
 * FASE 5: Automatizaciones Autónomas
 */

import { CronJob } from 'cron';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../../config/database';
import { AutomationWorker } from '../workers/automation.worker';

// Interfaces
export interface ScheduleConfig {
  name: string;
  cronExpression: string;  // "0 9 * * *" = todos los días a las 9am
  taskType: TaskType;
  taskConfig: Record<string, any>;
  agentId?: string;
  enabled?: boolean;
  timezone?: string;
}

export type TaskType =
  | 'stock_check'
  | 'alert'
  | 'follow_up'
  | 'report'
  | 'custom'
  // AI-powered automations
  | 'ai_daily_summary'
  | 'ai_proactive_followup'
  | 'ai_sentiment_alert';

export interface ScheduledTask {
  id: string;
  tenantId: string;
  name: string;
  cronExpression: string;
  taskType: TaskType;
  taskConfig: Record<string, any>;
  agentId?: string;
  enabled: boolean;
  timezone: string;
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskExecution {
  id: string;
  taskId: string;
  tenantId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  result?: Record<string, any>;
  error?: string;
}

export interface TaskTypeConfig {
  stock_check: {
    threshold: number;
    products?: string[];
    notifyTo?: string;
  };
  alert: {
    message: string;
    recipients: string[];
    channels: ('whatsapp' | 'email')[];
  };
  follow_up: {
    daysSinceLastContact: number;
    messageTemplate?: string;
    maxContacts?: number;
  };
  report: {
    type: 'daily' | 'weekly' | 'monthly';
    includeStats: boolean;
    recipients: string[];
  };
  custom: {
    script: string;
    parameters?: Record<string, any>;
  };
  // AI automation configs
  ai_daily_summary: {
    timeOfDay: string;
    recipients: Array<{ type: string; address: string; enabled: boolean }>;
    format: 'brief' | 'detailed' | 'executive';
    includeMetrics: boolean;
    includeIssues: boolean;
    includePositiveFeedback: boolean;
    customPrompt?: string;
  };
  ai_proactive_followup: {
    trigger: 'inactive_customers' | 'sentiment_drop' | 'unresolved_issue' | 'after_purchase' | 'birthday' | 'milestone';
    triggerConfig: Record<string, any>;
    messageConfig: {
      useTemplate: boolean;
      template?: string;
      customPrompt?: string;
      tone: 'friendly' | 'professional' | 'casual' | 'empathetic';
      includeCallToAction: boolean;
    };
    deliveryConfig: {
      channel: 'whatsapp' | 'email' | 'both';
      scheduleImmediately: boolean;
      scheduledTime?: string;
    };
    rateLimit?: {
      maxMessagesPerHour: number;
      maxMessagesPerDay: number;
    };
  };
  ai_sentiment_alert: {
    lookbackHours: number;
    minSeverity: 'critical' | 'high' | 'medium' | 'low';
    recipients: string[];
  };
}

export class SchedulerService {
  private jobs: Map<string, CronJob> = new Map();
  private worker: AutomationWorker;

  constructor() {
    this.worker = new AutomationWorker();
  }

  /**
   * Programa una nueva tarea
   */
  async scheduleTask(
    tenantId: string,
    config: ScheduleConfig
  ): Promise<ScheduledTask> {
    const taskId = uuidv4();
    const timezone = config.timezone || 'America/Mexico_City';

    // Validar expresión cron
    if (!this.validateCronExpression(config.cronExpression)) {
      throw new Error(`Expresión cron inválida: ${config.cronExpression}`);
    }

    // Validar configuración de automatización de IA
    if (config.taskType.startsWith('ai_')) {
      const validation = this.validateAIAutomationConfig(config.taskType, config.taskConfig);
      if (!validation.valid) {
        throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
      }
    }

    // Crear registro en BD
    const task = await prisma.scheduledTask.create({
      data: {
        id: taskId,
        tenantId,
        name: config.name,
        cronExpression: config.cronExpression,
        taskType: config.taskType,
        taskConfig: config.taskConfig as any,
        agentId: config.agentId,
        enabled: config.enabled ?? true,
        timezone,
        runCount: 0,
      },
    });

    // Crear job si está habilitado
    const mappedTask = this.mapToScheduledTask(task);
    if (mappedTask.enabled) {
      await this.startJob(mappedTask);
    }

    return mappedTask;
  }

  /**
   * Lista todas las tareas programadas de un tenant
   */
  async listScheduledTasks(tenantId: string): Promise<ScheduledTask[]> {
    const tasks = await prisma.scheduledTask.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return tasks.map(t => this.mapToScheduledTask(t));
  }

  /**
   * Obtiene una tarea por ID
   */
  async getTask(taskId: string): Promise<ScheduledTask | null> {
    const task = await prisma.scheduledTask.findUnique({
      where: { id: taskId },
    });

    return task ? this.mapToScheduledTask(task) : null;
  }

  /**
   * Actualiza una tarea programada
   */
  async updateTask(
    taskId: string,
    updates: Partial<ScheduleConfig>
  ): Promise<ScheduledTask> {
    const existing = await prisma.scheduledTask.findUnique({
      where: { id: taskId },
    });

    if (!existing) {
      throw new Error('Tarea no encontrada');
    }

    // Validar nueva expresión cron si se proporciona
    if (updates.cronExpression && !this.validateCronExpression(updates.cronExpression)) {
      throw new Error(`Expresión cron inválida: ${updates.cronExpression}`);
    }

    // Validar configuración de automatización de IA si se actualiza
    const taskTypeToValidate = updates.taskType || existing.taskType as TaskType;
    const configToValidate = updates.taskConfig || existing.taskConfig as any;
    if (taskTypeToValidate.startsWith('ai_') && updates.taskConfig) {
      const validation = this.validateAIAutomationConfig(taskTypeToValidate, configToValidate);
      if (!validation.valid) {
        throw new Error(`Configuración inválida: ${validation.errors.join(', ')}`);
      }
    }

    // Detener job anterior si existe
    this.stopJob(taskId);

    // Actualizar en BD
    const updated = await prisma.scheduledTask.update({
      where: { id: taskId },
      data: {
        name: updates.name,
        cronExpression: updates.cronExpression,
        taskType: updates.taskType,
        taskConfig: updates.taskConfig as any,
        agentId: updates.agentId,
        enabled: updates.enabled,
        timezone: updates.timezone,
        updatedAt: new Date(),
      },
    });

    // Reiniciar job si está habilitado
    if (updated.enabled) {
      await this.startJob(this.mapToScheduledTask(updated));
    }

    return this.mapToScheduledTask(updated);
  }

  /**
   * Cancela/Elimina una tarea programada
   */
  async cancelTask(taskId: string): Promise<void> {
    // Detener el job
    this.stopJob(taskId);

    // Eliminar de BD
    await prisma.scheduledTask.delete({
      where: { id: taskId },
    });
  }

  /**
   * Habilita/Deshabilita una tarea
   */
  async toggleTask(taskId: string, enabled: boolean): Promise<ScheduledTask> {
    const task = await prisma.scheduledTask.update({
      where: { id: taskId },
      data: { enabled, updatedAt: new Date() },
    });

    if (enabled) {
      await this.startJob(this.mapToScheduledTask(task));
    } else {
      this.stopJob(taskId);
    }

    return this.mapToScheduledTask(task);
  }

  /**
   * Ejecuta una tarea manualmente
   */
  async executeTaskNow(taskId: string): Promise<TaskExecution> {
    const task = await this.getTask(taskId);

    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    return this.executeTask(task);
  }

  /**
   * Obtiene el historial de ejecuciones de una tarea
   */
  async getExecutionHistory(
    taskId: string,
    limit: number = 20
  ): Promise<TaskExecution[]> {
    const executions = await prisma.taskExecution.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      take: limit,
    });

    return executions.map(e => ({
      id: e.id,
      taskId: e.taskId,
      tenantId: e.tenantId,
      status: e.status as TaskExecution['status'],
      startedAt: e.startedAt,
      completedAt: e.completedAt || undefined,
      result: e.result as Record<string, any> | undefined,
      error: e.error || undefined,
    }));
  }

  /**
   * Obtiene estadísticas de automatizaciones
   */
  async getStats(tenantId: string): Promise<{
    totalTasks: number;
    enabledTasks: number;
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    avgExecutionTime: number;
  }> {
    const totalTasks = await prisma.scheduledTask.count({
      where: { tenantId },
    });

    const enabledTasks = await prisma.scheduledTask.count({
      where: { tenantId, enabled: true },
    });

    const executions = await prisma.taskExecution.findMany({
      where: { tenantId },
      select: { status: true, startedAt: true, completedAt: true },
    });

    const successfulExecutions = executions.filter(e => e.status === 'completed').length;
    const failedExecutions = executions.filter(e => e.status === 'failed').length;

    // Calcular tiempo promedio de ejecución
    const completedExecutions = executions.filter(
      e => e.status === 'completed' && e.completedAt
    );

    const avgExecutionTime = completedExecutions.length > 0
      ? completedExecutions.reduce((sum, e) => {
          const duration = e.completedAt!.getTime() - e.startedAt.getTime();
          return sum + duration;
        }, 0) / completedExecutions.length
      : 0;

    return {
      totalTasks,
      enabledTasks,
      totalExecutions: executions.length,
      successfulExecutions,
      failedExecutions,
      avgExecutionTime: Math.round(avgExecutionTime),
    };
  }

  /**
   * Inicializa todas las tareas al arrancar el servidor
   */
  async initializeAllJobs(): Promise<void> {
    const enabledTasks = await prisma.scheduledTask.findMany({
      where: { enabled: true },
    });

    for (const task of enabledTasks) {
      try {
        await this.startJob(this.mapToScheduledTask(task));
      } catch (error) {
        console.error(`Error inicializando tarea ${task.id}:`, error);
      }
    }

    console.log(`Inicializadas ${enabledTasks.length} tareas programadas`);
  }

  /**
   * Detiene todas las tareas (para shutdown)
   */
  async stopAllJobs(): Promise<void> {
    for (const [taskId] of this.jobs) {
      this.stopJob(taskId);
    }
    console.log('Todas las tareas detenidas');
  }

  // ============================================
  // Métodos privados
  // ============================================

  private async startJob(task: ScheduledTask): Promise<void> {
    // No crear si ya existe
    if (this.jobs.has(task.id)) {
      return;
    }

    const job = new CronJob(
      task.cronExpression,
      async () => {
        try {
          await this.executeTask(task);
        } catch (error: any) {
          console.error(`Error ejecutando tarea ${task.id}:`, error);
        }
      },
      null,
      true,  // start
      task.timezone
    );

    this.jobs.set(task.id, job);

    // Actualizar nextRunAt
    await this.updateNextRunTime(task.id, job);
  }

  private stopJob(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
    }
  }

  private async executeTask(task: ScheduledTask): Promise<TaskExecution> {
    const executionId = uuidv4();

    // Crear registro de ejecución
    const execution = await prisma.taskExecution.create({
      data: {
        id: executionId,
        taskId: task.id,
        tenantId: task.tenantId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    try {
      // Ejecutar el worker
      const result = await this.worker.process({
        tenantId: task.tenantId,
        taskType: task.taskType,
        taskConfig: task.taskConfig,
        agentId: task.agentId,
      });

      // Actualizar ejecución como completada
      const completed = await prisma.taskExecution.update({
        where: { id: executionId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          result: result as any,
        },
      });

      // Actualizar tarea
      await prisma.scheduledTask.update({
        where: { id: task.id },
        data: {
          lastRunAt: new Date(),
          runCount: { increment: 1 },
        },
      });

      // Actualizar nextRunAt
      const job = this.jobs.get(task.id);
      if (job) {
        await this.updateNextRunTime(task.id, job);
      }

      return {
        id: completed.id,
        taskId: completed.taskId,
        tenantId: completed.tenantId,
        status: 'completed',
        startedAt: completed.startedAt,
        completedAt: completed.completedAt || undefined,
        result: completed.result as Record<string, any>,
      };
    } catch (error: any) {
      // Actualizar ejecución como fallida
      const failed = await prisma.taskExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          error: error.message,
        },
      });

      return {
        id: failed.id,
        taskId: failed.taskId,
        tenantId: failed.tenantId,
        status: 'failed',
        startedAt: failed.startedAt,
        completedAt: failed.completedAt || undefined,
        error: failed.error || undefined,
      };
    }
  }

  private async updateNextRunTime(taskId: string, job: CronJob): Promise<void> {
    const nextRun = job.nextDate();
    if (nextRun) {
      await prisma.scheduledTask.update({
        where: { id: taskId },
        data: { nextRunAt: nextRun.toJSDate() },
      });
    }
  }

  private validateCronExpression(expression: string): boolean {
    try {
      // Intentar crear un CronJob para validar
      new CronJob(expression, () => {}, null, false);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Valida la configuración de una automatización de IA
   */
  validateAIAutomationConfig(taskType: TaskType, config: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    switch (taskType) {
      case 'ai_daily_summary':
        return this.validateAISummaryConfig(config);

      case 'ai_proactive_followup':
        return this.validateAIProactiveConfig(config);

      case 'ai_sentiment_alert':
        return this.validateAISentimentAlertConfig(config);

      default:
        return { valid: true, errors: [] };
    }
  }

  private validateAISummaryConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.timeOfDay) {
      errors.push('timeOfDay is required');
    } else if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(config.timeOfDay)) {
      errors.push('timeOfDay must be in HH:MM format');
    }

    if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
      errors.push('At least one recipient is required');
    } else {
      const enabledRecipients = config.recipients.filter((r: any) => r.enabled);
      if (enabledRecipients.length === 0) {
        errors.push('At least one enabled recipient is required');
      }
    }

    if (!['brief', 'detailed', 'executive'].includes(config.format)) {
      errors.push('format must be brief, detailed, or executive');
    }

    return { valid: errors.length === 0, errors };
  }

  private validateAIProactiveConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    const validTriggers = ['inactive_customers', 'sentiment_drop', 'unresolved_issue', 'after_purchase', 'birthday', 'milestone'];
    if (!config.trigger || !validTriggers.includes(config.trigger)) {
      errors.push(`trigger must be one of: ${validTriggers.join(', ')}`);
    }

    if (!config.messageConfig) {
      errors.push('messageConfig is required');
    } else {
      if (!['friendly', 'professional', 'casual', 'empathetic'].includes(config.messageConfig.tone)) {
        errors.push('messageConfig.tone must be friendly, professional, casual, or empathetic');
      }
    }

    if (!config.deliveryConfig) {
      errors.push('deliveryConfig is required');
    } else {
      if (!['whatsapp', 'email', 'both'].includes(config.deliveryConfig.channel)) {
        errors.push('deliveryConfig.channel must be whatsapp, email, or both');
      }
    }

    if (config.rateLimit) {
      if (config.rateLimit.maxMessagesPerHour < 1 || config.rateLimit.maxMessagesPerHour > 1000) {
        errors.push('rateLimit.maxMessagesPerHour must be between 1 and 1000');
      }
      if (config.rateLimit.maxMessagesPerDay < 1 || config.rateLimit.maxMessagesPerDay > 10000) {
        errors.push('rateLimit.maxMessagesPerDay must be between 1 and 10000');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private validateAISentimentAlertConfig(config: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!config.lookbackHours || config.lookbackHours < 1 || config.lookbackHours > 168) {
      errors.push('lookbackHours must be between 1 and 168 (7 days)');
    }

    if (!['critical', 'high', 'medium', 'low'].includes(config.minSeverity)) {
      errors.push('minSeverity must be critical, high, medium, or low');
    }

    if (!config.recipients || !Array.isArray(config.recipients) || config.recipients.length === 0) {
      errors.push('At least one recipient is required');
    }

    return { valid: errors.length === 0, errors };
  }

  private mapToScheduledTask(task: any): ScheduledTask {
    return {
      id: task.id,
      tenantId: task.tenantId,
      name: task.name,
      cronExpression: task.cronExpression,
      taskType: task.taskType as TaskType,
      taskConfig: task.taskConfig as Record<string, any>,
      agentId: task.agentId || undefined,
      enabled: task.enabled,
      timezone: task.timezone,
      lastRunAt: task.lastRunAt || undefined,
      nextRunAt: task.nextRunAt || undefined,
      runCount: task.runCount,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

export const schedulerService = new SchedulerService();
