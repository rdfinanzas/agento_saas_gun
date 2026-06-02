/**
 * AutomationController - Controlador para automatizaciones
 * FASE 5: Automatizaciones Autónomas
 */

import { Request, Response } from 'express';
import {
  schedulerService,
  ScheduleConfig,
  ScheduledTask,
} from '../services/scheduler.service';

export class AutomationController {
  /**
   * Crea una nueva tarea programada
   */
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config: ScheduleConfig = {
        name: req.body.name,
        cronExpression: req.body.cronExpression,
        taskType: req.body.taskType,
        taskConfig: req.body.taskConfig || {},
        agentId: req.body.agentId,
        enabled: req.body.enabled ?? true,
        timezone: req.body.timezone,
      };

      if (!config.name || !config.cronExpression || !config.taskType) {
        res.status(400).json({
          error: 'Faltan campos requeridos: name, cronExpression, taskType',
        });
        return;
      }

      const task = await schedulerService.scheduleTask(tenantId, config);

      res.status(201).json({
        success: true,
        task,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista todas las tareas programadas
   */
  async listTasks(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const tasks = await schedulerService.listScheduledTasks(tenantId);

      res.json({
        success: true,
        tasks,
        count: tasks.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene una tarea por ID
   */
  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const task = await schedulerService.getTask(taskId);

      if (!task) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      res.json({
        success: true,
        task,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza una tarea programada
   */
  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const updates: Partial<ScheduleConfig> = req.body;

      const task = await schedulerService.updateTask(taskId, updates);

      res.json({
        success: true,
        task,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina una tarea programada
   */
  async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      await schedulerService.cancelTask(taskId);

      res.json({
        success: true,
        message: 'Tarea eliminada',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Habilita/Deshabilita una tarea
   */
  async toggleTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const { enabled } = req.body;

      if (typeof enabled !== 'boolean') {
        res.status(400).json({ error: 'Campo enabled es requerido (boolean)' });
        return;
      }

      const task = await schedulerService.toggleTask(taskId, enabled);

      res.json({
        success: true,
        task,
        message: enabled ? 'Tarea habilitada' : 'Tarea deshabilitada',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Ejecuta una tarea manualmente
   */
  async executeTaskNow(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const execution = await schedulerService.executeTaskNow(taskId);

      res.json({
        success: true,
        execution,
        message: execution.status === 'completed'
          ? 'Tarea ejecutada exitosamente'
          : 'Tarea en ejecución',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene historial de ejecuciones
   */
  async getExecutionHistory(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const executions = await schedulerService.getExecutionHistory(taskId, limit);

      res.json({
        success: true,
        executions,
        count: executions.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene estadísticas de automatizaciones
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const stats = await schedulerService.getStats(tenantId);

      res.json({
        success: true,
        stats,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Valida una expresión cron
   */
  async validateCron(req: Request, res: Response): Promise<void> {
    try {
      const { expression } = req.body;

      if (!expression) {
        res.status(400).json({ error: 'Expresión cron requerida' });
        return;
      }

      // Usar el servicio para validar
      const { CronJob } = require('cron');
      let valid = false;
      let nextRuns: Date[] = [];
      let error: string | null = null;

      try {
        const job = new CronJob(expression, () => {}, null, false);
        valid = true;

        // Obtener próximas ejecuciones
        for (let i = 0; i < 5; i++) {
          const next = job.nextDate();
          if (next) {
            nextRuns.push(next.toJSDate());
          }
        }
      } catch (e: any) {
        error = e.message;
      }

      res.json({
        success: true,
        valid,
        expression,
        nextRuns: valid ? nextRuns : undefined,
        error: error || undefined,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene tipos de tareas disponibles
   */
  async getTaskTypes(req: Request, res: Response): Promise<void> {
    const taskTypes = [
      {
        type: 'stock_check',
        name: 'Verificación de Stock',
        description: 'Revisa niveles de stock y alerta si están bajos',
        configSchema: {
          threshold: { type: 'number', required: true, description: 'Umbral mínimo de stock' },
          products: { type: 'array', description: 'Lista de productos a verificar (opcional)' },
          notifyTo: { type: 'string', description: 'Número a notificar' },
        },
      },
      {
        type: 'alert',
        name: 'Envío de Alertas',
        description: 'Envía alertas programadas a destinatarios',
        configSchema: {
          message: { type: 'string', required: true, description: 'Mensaje de alerta' },
          recipients: { type: 'array', required: true, description: 'Lista de destinatarios' },
          channels: { type: 'array', description: 'Canales: whatsapp, email' },
        },
      },
      {
        type: 'follow_up',
        name: 'Seguimiento de Clientes',
        description: 'Contacta clientes después de X días sin interacción',
        configSchema: {
          daysSinceLastContact: { type: 'number', required: true, description: 'Días sin contacto' },
          messageTemplate: { type: 'string', description: 'Template de mensaje' },
          maxContacts: { type: 'number', description: 'Máximo de contactos por ejecución' },
        },
      },
      {
        type: 'report',
        name: 'Generación de Reportes',
        description: 'Genera y envía reportes periódicos',
        configSchema: {
          type: { type: 'string', required: true, enum: ['daily', 'weekly', 'monthly'] },
          includeStats: { type: 'boolean', description: 'Incluir estadísticas' },
          recipients: { type: 'array', required: true, description: 'Destinatarios del reporte' },
        },
      },
      {
        type: 'custom',
        name: 'Script Personalizado',
        description: 'Ejecuta scripts predefinidos',
        configSchema: {
          script: { type: 'string', required: true, description: 'Nombre del script' },
          parameters: { type: 'object', description: 'Parámetros del script' },
        },
      },
    ];

    res.json({
      success: true,
      taskTypes,
    });
  }
}

export const automationController = new AutomationController();
