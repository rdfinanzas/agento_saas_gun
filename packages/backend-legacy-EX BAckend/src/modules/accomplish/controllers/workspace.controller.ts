/**
 * Workspace Controller - Controlador para gestión de workspace
 *
 * Maneja las solicitudes HTTP relacionadas con workspace y archivos
 */

import { Request, Response } from 'express';
import { workspaceService } from '../services/workspace.service';
import { cleanupService } from '../services/cleanup.service';
import { FileType } from '@prisma/client';

export class WorkspaceController {
  /**
   * Obtiene el uso de espacio del tenant
   */
  async getUsage(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const usage = await workspaceService.calculateUsage(tenantId);

      res.json({
        success: true,
        data: usage,
      });
    } catch (error: any) {
      console.error('Error getting workspace usage:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo uso de workspace',
      });
    }
  }

  /**
   * Lista archivos del workspace
   */
  async listFiles(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { type, search } = req.query;

      const fileType = type as FileType | undefined;
      const files = await workspaceService.listFiles(
        tenantId,
        fileType,
        search as string | undefined
      );

      res.json({
        success: true,
        data: files,
      });
    } catch (error: any) {
      console.error('Error listing workspace files:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error listando archivos',
      });
    }
  }

  /**
   * Elimina un archivo
   */
  async deleteFile(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { fileId } = req.params;

      await workspaceService.deleteFile(fileId, tenantId);

      res.json({
        success: true,
        message: 'Archivo eliminado correctamente',
      });
    } catch (error: any) {
      console.error('Error deleting file:', error);

      if (error.message === 'Archivo no encontrado') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error eliminando archivo',
      });
    }
  }

  /**
   * Mueve un archivo de tarea a archivos de usuario
   */
  async moveFile(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;
      const { taskId, filePath } = req.body;

      if (!taskId || !filePath) {
        res.status(400).json({
          success: false,
          error: 'taskId y filePath son requeridos',
        });
        return;
      }

      await workspaceService.moveToUserFiles(taskId, filePath, tenantId);

      res.json({
        success: true,
        message: 'Archivo movido correctamente',
      });
    } catch (error: any) {
      console.error('Error moving file:', error);

      if (error.message === 'Tarea no encontrada' || error.message === 'Archivo no encontrado en la tarea') {
        res.status(404).json({
          success: false,
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error.message || 'Error moviendo archivo',
      });
    }
  }

  /**
   * Fuerza la limpieza del workspace
   */
  async forceCleanup(req: Request, res: Response): Promise<void> {
    try {
      const result = await cleanupService.forceCleanup();

      res.json({
        success: true,
        message: 'Limpieza ejecutada correctamente',
        data: result,
      });
    } catch (error: any) {
      console.error('Error forcing cleanup:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error ejecutando limpieza',
      });
    }
  }

  /**
   * Limpia una tarea específica
   */
  async cleanupTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;

      await cleanupService.cleanupTask(taskId);

      res.json({
        success: true,
        message: 'Tarea limpiada correctamente',
      });
    } catch (error: any) {
      console.error('Error cleaning up task:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error limpiando tarea',
      });
    }
  }

  /**
   * Obtiene estadísticas del workspace
   */
  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tenantId = req.tenantId!;

      const usage = await workspaceService.calculateUsage(tenantId);
      const files = await workspaceService.listFiles(tenantId);

      // Agrupar archivos por tipo
      const filesByType = {
        USER: files.filter((f) => f.type === 'USER').length,
        TASK: files.filter((f) => f.type === 'TASK').length,
        TEMP: files.filter((f) => f.type === 'TEMP').length,
      };

      res.json({
        success: true,
        data: {
          usage,
          filesCount: files.length,
          filesByType,
        },
      });
    } catch (error: any) {
      console.error('Error getting workspace stats:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error obteniendo estadísticas',
      });
    }
  }
}

// Singleton instance
export const workspaceController = new WorkspaceController();
