/**
 * AccomplishService - Servicio principal para ejecución de tareas en modo FULL
 *
 * Este servicio orquesta la ejecución de tareas agenticas usando el FullModeAdapter
 */

import { PrismaClient, TaskStatus, FileType } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

import {
  CreateTaskDto,
  TaskDto,
  FollowUpDto,
  TaskHistoryQueryDto,
  TaskHistoryDto,
  WorkspaceUsageDto,
} from '../dto/accomplish.dto';
import { streamingService } from './streaming.service';
import { fullModeIntegrationService } from './fullmode-integration.service';

const prisma = new PrismaClient();

// EventEmitter para streaming de eventos
import { EventEmitter } from 'events';

export class AccomplishService extends EventEmitter {
  private readonly WORKSPACE_BASE = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'storage', 'tenants');
  private readonly DEFAULT_TASK_TIMEOUT = 10 * 60 * 1000; // 10 minutos
  private readonly TASK_RETENTION_DAYS = 30;

  /**
   * Crea y ejecuta una nueva tarea
   */
  async executeTask(tenantId: string, dto: CreateTaskDto): Promise<TaskDto> {
    console.log(`[executeTask] Iniciando ejecución de tarea para tenant ${tenantId}`);

    // Verificar cuota del tenant
    await this.checkQuota(tenantId);

    // Crear tarea en BD
    const task = await prisma.accomplishTask.create({
      data: {
        id: uuidv4(),
        tenantId,
        userId: dto.userId, // Guardar userId del JWT
        prompt: dto.prompt,
        status: TaskStatus.QUEUED,
        sessionId: dto.sessionId,
        messages: [],
        createdAt: new Date(),
      },
    });

    console.log(`[executeTask] Tarea creada con ID: ${task.id}`);

    // Crear workspace para la tarea
    const workspacePath = this.createTaskWorkspace(tenantId, task.id);
    await prisma.accomplishTask.update({
      where: { id: task.id },
      data: { workspacePath },
    });

    console.log(`[executeTask] Workspace creado: ${workspacePath}`);

    // Emitir evento de creación
    this.emit('task:created', { taskId: task.id, tenantId });

    // Iniciar ejecución asíncrona
    console.log(`[executeTask] Iniciando runTask de forma asíncrona`);
    this.runTask(task.id, tenantId, dto.prompt, workspacePath).catch((error) => {
      console.error(`Error ejecutando tarea ${task.id}:`, error);
    });

    return this.mapToDto(task);
  }

  /**
   * Envía un follow-up a una sesión existente
   */
  async sendFollowUp(taskId: string, dto: FollowUpDto): Promise<TaskDto> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    if (task.status !== TaskStatus.COMPLETED && task.status !== TaskStatus.FAILED) {
      throw new Error('Solo se puede hacer follow-up en tareas completadas');
    }

    // Agregar mensaje de follow-up
    const messages = task.messages as any[];
    messages.push({
      id: uuidv4(),
      role: 'user',
      content: dto.message,
      timestamp: new Date(),
    });

    // Actualizar tarea
    const updatedTask = await prisma.accomplishTask.update({
      where: { id: taskId },
      data: {
        messages,
        status: TaskStatus.QUEUED,
        sessionId: task.id, // Usar el ID original como sessionId
      },
    });

    // Re-ejecutar
    this.runTask(taskId, task.tenantId, dto.message, task.workspacePath!).catch((error) => {
      console.error(`Error en follow-up ${taskId}:`, error);
    });

    return this.mapToDto(updatedTask);
  }

  /**
   * Cancela una tarea en ejecución
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    if (task.status !== TaskStatus.RUNNING && task.status !== TaskStatus.QUEUED) {
      throw new Error('Solo se pueden cancelar tareas en ejecución o en cola');
    }

    await prisma.accomplishTask.update({
      where: { id: taskId },
      data: {
        status: TaskStatus.CANCELLED,
        completedAt: new Date(),
      },
    });

    // Emitir evento de cancelación
    this.emit('task:cancelled', { taskId });

    // TODO: Enviar señal de cancelación al proceso que está ejecutando
  }

  /**
   * Obtiene una tarea por ID
   */
  async getTask(taskId: string): Promise<TaskDto | null> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    });

    return task ? this.mapToDto(task) : null;
  }

  /**
   * Obtiene el historial de tareas de un tenant
   * SEGURIDAD: Filtra por userId para que cada usuario solo vea sus tareas
   */
  async getHistory(tenantId: string, query: TaskHistoryQueryDto = {}): Promise<TaskHistoryDto> {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = { tenantId };

    // SEGURIDAD: Siempre filtrar por userId si está presente
    // Esto asegura que los usuarios solo vean sus propias tareas
    if (query.userId) {
      where.userId = query.userId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.fromDate || query.toDate) {
      where.createdAt = {};
      if (query.fromDate) where.createdAt.gte = query.fromDate;
      if (query.toDate) where.createdAt.lte = query.toDate;
    }

    const [tasks, total] = await Promise.all([
      prisma.accomplishTask.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.accomplishTask.count({ where }),
    ]);

    return {
      tasks: tasks.map((t) => this.mapToDto(t)),
      total,
      page,
      pageSize,
    };
  }

  /**
   * Ejecuta la tarea (método privado asíncrono)
   */
  private async runTask(
    taskId: string,
    tenantId: string,
    prompt: string,
    workspacePath: string
  ): Promise<void> {
    try {
      console.log(`[runTask] Iniciando ejecución de tarea ${taskId}`);

      // Actualizar estado a RUNNING
      await prisma.accomplishTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.RUNNING,
          startedAt: new Date(),
        },
      });

      console.log(`[runTask] Estado actualizado a RUNNING`);

      // Emitir eventos
      this.emit('task:started', { taskId });
      streamingService.emitProgress(taskId, 'started', 0, 'Iniciando tarea...');

      // Emitir mensaje inicial
      streamingService.emitMessage(taskId, 'assistant', `Entendido. Voy a procesar tu solicitud: "${prompt}"`);

      console.log(`[runTask] Llamando a fullModeIntegrationService.executeTask`);

      // USAR FULL MODE INTEGRATION SERVICE
      // Ejecutar con el FullModeAdapter real
      await fullModeIntegrationService.executeTask(
        taskId,
        tenantId,
        prompt,
        workspacePath
      );

      console.log(`[runTask] Tarea ${taskId} completada exitosamente`);

      // Note: La actualización de BD se maneja dentro del servicio de integración

    } catch (error: any) {
      console.error(`Error ejecutando tarea ${taskId}:`, error);

      await prisma.accomplishTask.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          error: error.message || 'Error desconocido',
        },
      });

      this.emit('task:failed', { taskId, error: error.message });
      streamingService.emitError(taskId, error.message || 'Error desconocido');
    }
  }

  /**
   * Crea el workspace para una tarea
   */
  private createTaskWorkspace(tenantId: string, taskId: string): string {
    const taskPath = path.join(this.WORKSPACE_BASE, tenantId, 'tasks', taskId);

    if (!fs.existsSync(taskPath)) {
      fs.mkdirSync(taskPath, { recursive: true });
    }

    return taskPath;
  }

  /**
   * Verifica la cuota del tenant
   */
  private async checkQuota(tenantId: string): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant no encontrado');
    }

    // TODO: Calcular el uso real de almacenamiento desde workspaceFile
    // Por ahora, omitimos la verificación de cuota
    const quota = Number(tenant.quotaMaxStorage);

    // Omitir verificación de cuota temporalmente
    // if (used >= quota) {
    //   throw new Error('Cuota de almacenamiento excedida. Por favor, libera espacio o actualiza tu plan.');
    // }
  }

  /**
   * Calcula el uso de workspace de un tenant
   */
  async calculateWorkspaceUsage(tenantId: string): Promise<WorkspaceUsageDto> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant no encontrado');
    }

    const files = await prisma.workspaceFile.findMany({
      where: { tenantId },
    });

    const userFilesTotal = files
      .filter((f) => f.type === FileType.USER)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const tasksTotal = files
      .filter((f) => f.type === FileType.TASK)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const tempTotal = files
      .filter((f) => f.type === FileType.TEMP)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const used = userFilesTotal + tasksTotal + tempTotal;
    const quota = Number(tenant.quotaMaxStorage);

    return {
      tenantId,
      used,
      quota,
      percentUsed: quota > 0 ? (used / quota) * 100 : 0,
      userFiles: userFilesTotal,
      tasks: tasksTotal,
      temp: tempTotal,
    };
  }

  /**
   * Mapea una entidad de BD a DTO
   */
  private mapToDto(task: any): TaskDto {
    return {
      id: task.id,
      tenantId: task.tenantId,
      userId: task.userId || undefined, // Incluir userId en la respuesta
      prompt: task.prompt,
      status: task.status,
      sessionId: task.sessionId || undefined,
      messages: task.messages || [],
      result: task.result,
      error: task.error || undefined,
      workspacePath: task.workspacePath || undefined,
      createdAt: task.createdAt,
      startedAt: task.startedAt || undefined,
      completedAt: task.completedAt || undefined,
    };
  }

  /**
   * Re-ejecuta una tarea existente
   * SEGURIDAD: Verifica que el usuario tiene permiso para re-ejecutar
   */
  async reExecuteTask(taskId: string, tenantId: string, userId?: string): Promise<TaskDto> {
    const originalTask = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    });

    if (!originalTask) {
      throw new Error('Tarea no encontrada');
    }

    if (originalTask.tenantId !== tenantId) {
      throw new Error('No tienes permiso para re-ejecutar esta tarea');
    }

    // SEGURIDAD: Verificar userId - los usuarios solo pueden re-ejecutar sus propias tareas
    if (originalTask.userId && originalTask.userId !== userId) {
      throw new Error('No tienes permiso para re-ejecutar esta tarea');
    }

    // Crear nueva tarea con el mismo prompt
    return this.executeTask(tenantId, {
      prompt: originalTask.prompt,
      sessionId: originalTask.id, // Referenciar la tarea original
      userId, // Pasar userId para asociar la nueva tarea al usuario actual
    });
  }

  /**
   * Elimina una tarea y sus archivos asociados
   * SEGURIDAD: Verifica que el usuario tiene permiso para eliminar
   */
  async deleteTask(taskId: string, tenantId: string, userId?: string): Promise<void> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Tarea no encontrada');
    }

    if (task.tenantId !== tenantId) {
      throw new Error('No tienes permiso para eliminar esta tarea');
    }

    // SEGURIDAD: Verificar userId - los usuarios solo pueden eliminar sus propias tareas
    if (task.userId && task.userId !== userId) {
      throw new Error('No tienes permiso para eliminar esta tarea');
    }

    // Limpiar workspace
    if (task.workspacePath) {
      // Usar workspaceService para limpiar
      const { workspaceService } = await import('./workspace.service');
      await workspaceService.cleanupTaskWorkspace(taskId);
    }

    // Eliminar archivos de BD
    await prisma.workspaceFile.deleteMany({
      where: { taskId },
    });

    // Eliminar tarea
    await prisma.accomplishTask.delete({
      where: { id: taskId },
    });

    // Emitir evento de eliminación
    this.emit('task:deleted', { taskId });
  }

  /**
   * Obtiene los resultados de una tarea para descarga
   * SEGURIDAD: Verifica que el usuario tiene permiso para ver los resultados
   */
  async getTaskResults(taskId: string, tenantId: string, userId?: string): Promise<{
    taskId: string;
    prompt: string;
    status: string;
    messages: any[];
    result: any;
    createdAt: Date;
    completedAt?: Date;
    workspaceFiles?: any[];
  } | null> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
      include: {
        tenant: {
          select: { id: true },
        },
      },
    });

    if (!task || task.tenantId !== tenantId) {
      return null;
    }

    // SEGURIDAD: Verificar userId - los usuarios solo pueden ver sus propias tareas
    if (task.userId && task.userId !== userId) {
      return null;
    }

    // Obtener archivos del workspace si existen
    const workspaceFiles = task.workspacePath
      ? await prisma.workspaceFile.findMany({
          where: { taskId },
          select: {
            id: true,
            name: true,
            path: true,
            size: true,
            type: true,
            createdAt: true,
          },
        })
      : [];

    return {
      taskId: task.id,
      prompt: task.prompt,
      status: task.status,
      messages: task.messages as any[],
      result: task.result,
      createdAt: task.createdAt,
      completedAt: task.completedAt || undefined,
      workspaceFiles,
    };
  }

  /**
   * Exporta los resultados de una tarea a JSON
   * SEGURIDAD: Verifica que el usuario tiene permiso para exportar
   */
  async exportTaskResults(taskId: string, tenantId: string, userId?: string): Promise<{
    filename: string;
    content: string;
  } | null> {
    const results = await this.getTaskResults(taskId, tenantId, userId);

    if (!results) {
      return null;
    }

    const filename = `task-${taskId}-${new Date().getTime()}.json`;
    const content = JSON.stringify(results, null, 2);

    return { filename, content };
  }
}

// Singleton instance
export const accomplishService = new AccomplishService();
