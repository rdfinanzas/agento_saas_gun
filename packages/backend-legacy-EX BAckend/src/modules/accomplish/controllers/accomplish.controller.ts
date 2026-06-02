/**
 * AccomplishController - Controlador HTTP para el módulo Accomplish
 *
 * Maneja las peticiones HTTP para crear, gestionar y monitorear tareas
 */

import { Request, Response } from 'express';
import { accomplishService, permissionService, workspaceService, cleanupService, permissionEmitter, streamingService } from '../services';
import { CreateTaskDto, FollowUpDto, TaskHistoryQueryDto } from '../dto/accomplish.dto';
import { PrismaClient, TaskStatus } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export class AccomplishController {
  /**
   * Crea una nueva tarea
   * POST /api/v1/:tenant/accomplish/tasks
   */
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT
      const dto: CreateTaskDto = req.body;

      if (!dto.prompt || dto.prompt.trim().length === 0) {
        res.status(400).json({ error: 'El prompt es requerido' });
        return;
      }

      // SEGURIDAD: Agregar userId al DTO para asociar la tarea al usuario
      dto.userId = userId;

      const task = await accomplishService.executeTask(tenantId, dto);

      res.status(201).json(task);
    } catch (error: any) {
      console.error('Error creating task:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Endpoint de prueba para verificar SSE
   * POST /api/v1/:tenant/accomplish/test-sse
   */
  async testSSE(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { message = 'Hola' } = req.body;

      // Crear instancia de Prisma
      const prisma = new PrismaClient();

      // Crear tarea de prueba
      const task = await prisma.accomplishTask.create({
        data: {
          id: uuidv4(),
          tenantId,
          prompt: message,
          status: TaskStatus.RUNNING,
          messages: [],
          startedAt: new Date(),
          createdAt: new Date(),
        },
      });

      res.status(201).json(task);

      // Simular respuestas vía SSE después de un delay
      setTimeout(() => {
        streamingService.emitMessage(task.id, 'assistant', `¡Hola! Has dicho: "${message}"`);
      }, 1000);

      setTimeout(() => {
        streamingService.emitProgress(task.id, 'processing', 50, 'Procesando tu mensaje...');
      }, 2000);

      setTimeout(() => {
        streamingService.emitComplete(task.id, {
          success: true,
          content: `Respuesta simulada para: "${message}"`,
        });
        // Actualizar estado a completado
        prisma.accomplishTask.update({
          where: { id: task.id },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
          },
        }).catch(console.error);
      }, 3000);
    } catch (error: any) {
      console.error('Error en test SSE:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Obtiene una tarea por ID
   * GET /api/v1/:tenant/accomplish/tasks/:id
   */
  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      const task = await accomplishService.getTask(id);

      if (!task) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      // SEGURIDAD: Verificar tenantId
      if (task.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // SEGURIDAD: Verificar userId - los usuarios solo pueden ver sus propias tareas
      if (task.userId && task.userId !== userId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      res.json(task);
    } catch (error: any) {
      console.error('Error getting task:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Envía un follow-up a una tarea
   * POST /api/v1/:tenant/accomplish/tasks/:id/followup
   */
  async sendFollowUp(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT
      const dto: FollowUpDto = req.body;

      if (!dto.message || dto.message.trim().length === 0) {
        res.status(400).json({ error: 'El mensaje es requerido' });
        return;
      }

      // Verificar que la tarea pertenezca al tenant
      const existingTask = await accomplishService.getTask(id);
      if (!existingTask) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      if (existingTask.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // SEGURIDAD: Verificar userId - los usuarios solo pueden modificar sus propias tareas
      if (existingTask.userId && existingTask.userId !== userId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      const task = await accomplishService.sendFollowUp(id, dto);

      res.json(task);
    } catch (error: any) {
      console.error('Error sending follow-up:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Cancela una tarea
   * DELETE /api/v1/:tenant/accomplish/tasks/:id
   */
  async cancelTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      // Verificar que la tarea pertenezca al tenant
      const existingTask = await accomplishService.getTask(id);
      if (!existingTask) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      if (existingTask.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // SEGURIDAD: Verificar userId - los usuarios solo pueden cancelar sus propias tareas
      if (existingTask.userId && existingTask.userId !== userId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      await accomplishService.cancelTask(id);

      res.json({ success: true, message: 'Tarea cancelada' });
    } catch (error: any) {
      console.error('Error cancelling task:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Obtiene el historial de tareas
   * GET /api/v1/:tenant/accomplish/history
   */
  async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT
      const query: TaskHistoryQueryDto = {
        page: req.query.page ? parseInt(req.query.page as string) : undefined,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined,
        status: req.query.status as any,
        fromDate: req.query.fromDate ? new Date(req.query.fromDate as string) : undefined,
        toDate: req.query.toDate ? new Date(req.query.toDate as string) : undefined,
        userId, // SEGURIDAD: Filtrar por userId para que cada usuario solo vea sus tareas
      };

      const history = await accomplishService.getHistory(tenantId, query);

      res.json(history);
    } catch (error: any) {
      console.error('Error getting history:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Obtiene el detalle de una tarea del historial
   * GET /api/v1/:tenant/accomplish/history/:id
   */
  async getHistoryDetail(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      const task = await accomplishService.getTask(id);

      if (!task) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      // SEGURIDAD: Verificar tenantId
      if (task.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // SEGURIDAD: Verificar userId - los usuarios solo pueden ver sus propias tareas
      if (task.userId && task.userId !== userId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      res.json(task);
    } catch (error: any) {
      console.error('Error getting history detail:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Obtiene eventos SSE de una tarea
   * GET /api/v1/:tenant/accomplish/tasks/:id/events
   */
  async getTaskEvents(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      // Verificar que la tarea pertenezca al tenant
      const existingTask = await accomplishService.getTask(id);
      if (!existingTask) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      if (existingTask.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // SEGURIDAD: Verificar userId - los usuarios solo pueden recibir eventos de sus propias tareas
      if (existingTask.userId && existingTask.userId !== userId) {
        res.status(403).json({ error: 'No tienes acceso a esta tarea' });
        return;
      }

      // Configurar SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no'); // Deshabilitar buffering en nginx
      res.flushHeaders();

      // Registrar conexión en streaming service
      const connection = streamingService.registerConnection(id, tenantId);

      // Enviar eventos acumulados en el buffer
      const bufferedEvents = (streamingService as any).getBufferedEvents(id);
      for (const event of bufferedEvents) {
        const sseData = `data: ${JSON.stringify(event)}\n\n`;
        res.write(sseData);
      }

      // Enviar keepalive cada 30 segundos
      const keepAliveInterval = setInterval(() => {
        res.write(`: keepalive\n\n`);
      }, 30000);

      // Suscribirse a eventos de la conexión
      const unsubscribe = streamingService.subscribeToConnection(connection.id, (event) => {
        // Formatear evento como SSE
        const sseData = `data: ${JSON.stringify(event)}\n\n`;
        res.write(sseData);

        // Si el evento es de desconexión o completado, cerrar conexión
        if (event.type === 'disconnected' || event.type === 'complete' || event.type === 'error') {
          cleanup();
        }
      });

      // Función de limpieza
      const cleanup = () => {
        clearInterval(keepAliveInterval);
        unsubscribe();
        streamingService.disconnectConnection(connection.id);
      };

      // Cleanup al desconectar el cliente
      req.on('close', cleanup);
      req.on('end', cleanup);

    } catch (error: any) {
      console.error('Error getting task events:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message || 'Error interno del servidor' });
      }
    }
  }

  /**
   * Responde a una solicitud de permiso
   * POST /api/v1/:tenant/accomplish/permissions/:requestId/respond
   */
  async respondToPermission(req: Request, res: Response): Promise<void> {
    try {
      const { requestId } = req.params;
      const tenantId = req.tenantId!;
      const { decision, options, customResponse } = req.body;

      if (!decision || !['allow', 'deny'].includes(decision)) {
        res.status(400).json({ error: 'Decisión inválida. Debe ser "allow" o "deny"' });
        return;
      }

      // Verificar que el permiso pertenezca al tenant
      const pending = permissionService.getPendingPermission(requestId);
      if (!pending) {
        res.status(404).json({ error: 'Solicitud de permiso no encontrada o expirada' });
        return;
      }

      if (pending.tenantId !== tenantId) {
        res.status(403).json({ error: 'No tienes acceso a esta solicitud' });
        return;
      }

      await permissionService.respond(requestId, { decision, options, customResponse });

      res.json({ success: true, message: 'Respuesta enviada' });
    } catch (error: any) {
      console.error('Error responding to permission:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Re-ejecuta una tarea existente
   * POST /api/v1/:tenant/accomplish/tasks/:id/reexecute
   */
  async reExecuteTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      const newTask = await accomplishService.reExecuteTask(id, tenantId, userId);

      res.status(201).json({
        success: true,
        data: newTask,
      });
    } catch (error: any) {
      console.error('Error re-executing task:', error);

      if (error.message === 'Tarea no encontrada') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.message === 'No tienes permiso para re-ejecutar esta tarea') {
        res.status(403).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message || 'Error re-ejecutando tarea' });
    }
  }

  /**
   * Elimina una tarea
   * DELETE /api/v1/:tenant/accomplish/tasks/:id
   */
  async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      await accomplishService.deleteTask(id, tenantId, userId);

      res.json({
        success: true,
        message: 'Tarea eliminada correctamente',
      });
    } catch (error: any) {
      console.error('Error deleting task:', error);

      if (error.message === 'Tarea no encontrada') {
        res.status(404).json({ error: error.message });
        return;
      }

      if (error.message === 'No tienes permiso para eliminar esta tarea') {
        res.status(403).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: error.message || 'Error eliminando tarea' });
    }
  }

  /**
   * Obtiene los resultados de una tarea para descarga
   * GET /api/v1/:tenant/accomplish/tasks/:id/results
   */
  async getTaskResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      const results = await accomplishService.getTaskResults(id, tenantId, userId);

      if (!results) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      res.json({
        success: true,
        data: results,
      });
    } catch (error: any) {
      console.error('Error getting task results:', error);
      res.status(500).json({ error: error.message || 'Error obteniendo resultados' });
    }
  }

  /**
   * Exporta los resultados de una tarea a JSON
   * GET /api/v1/:tenant/accomplish/tasks/:id/export
   */
  async exportTaskResults(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;
      const userId = req.userId!; // Extraer userId del JWT

      const exported = await accomplishService.exportTaskResults(id, tenantId, userId);

      if (!exported) {
        res.status(404).json({ error: 'Tarea no encontrada' });
        return;
      }

      // Enviar como archivo para descarga
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
      res.send(exported.content);
    } catch (error: any) {
      console.error('Error exporting task results:', error);
      res.status(500).json({ error: error.message || 'Error exportando resultados' });
    }
  }

  /**
   * Obtiene el uso de workspace
   * GET /api/v1/:tenant/workspace/usage
   */
  async getWorkspaceUsage(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const usage = await workspaceService.calculateUsage(tenantId);
      res.json(usage);
    } catch (error: any) {
      console.error('Error getting workspace usage:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Lista archivos del workspace
   * GET /api/v1/:tenant/workspace/files
   */
  async listWorkspaceFiles(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const type = req.query.type as any;
      const search = req.query.search as string | undefined;

      const files = await workspaceService.listFiles(tenantId, type, search);
      res.json({ files, count: files.length });
    } catch (error: any) {
      console.error('Error listing workspace files:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Elimina un archivo del workspace
   * DELETE /api/v1/:tenant/workspace/files/:id
   */
  async deleteWorkspaceFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const tenantId = req.tenantId!;

      await workspaceService.deleteFile(id, tenantId);

      res.json({ success: true, message: 'Archivo eliminado' });
    } catch (error: any) {
      console.error('Error deleting workspace file:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Fuerza la limpieza de workspace
   * POST /api/v1/:tenant/workspace/cleanup
   */
  async forceCleanup(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      // Nota: En producción, esto debería ser un job administrativo
      // Por ahora, permitimos limpieza por tenant
      const result = await cleanupService.forceCleanup();

      res.json({ success: true, message: 'Limpieza completada', result });
    } catch (error: any) {
      console.error('Error forcing cleanup:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Obtiene configuración de permisos del tenant
   * GET /api/v1/:tenant/accomplish/permissions/config
   */
  async getPermissionsConfig(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config = await permissionService.getDefaultPermissions(tenantId);
      res.json(config);
    } catch (error: any) {
      console.error('Error getting permissions config:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }

  /**
   * Actualiza configuración de permisos del tenant
   * PUT /api/v1/:tenant/accomplish/permissions/config
   */
  async updatePermissionsConfig(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const config = req.body;

      await permissionService.updateDefaultPermissions(tenantId, config);

      res.json({ success: true, message: 'Configuración actualizada' });
    } catch (error: any) {
      console.error('Error updating permissions config:', error);
      res.status(500).json({ error: error.message || 'Error interno del servidor' });
    }
  }
}

export const accomplishController = new AccomplishController();
