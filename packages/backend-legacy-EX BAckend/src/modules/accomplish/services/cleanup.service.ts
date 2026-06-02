/**
 * CleanupService - Servicio para limpieza automática de workspaces
 *
 * Job programado que limpia archivos temporales y tareas antiguas
 */

import { PrismaClient, FileType, TaskStatus } from '@prisma/client';
import { workspaceService } from './workspace.service';
import * as fs from 'fs';

const prisma = new PrismaClient();

export class CleanupService {
  private readonly TASK_RETENTION_DAYS = 30;
  private readonly TEMP_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hora

  /**
   * Job diario de limpieza (ejecutado por cron)
   */
  async runCleanup(): Promise<void> {
    console.log('Iniciando limpieza de workspaces...');

    const stats = {
      tempCleaned: 0,
      tasksCleaned: 0,
      spaceFreed: 0,
      tenantsNotified: [] as string[],
    };

    try {
      // 1. Limpiar temp/ de tareas terminadas
      stats.tempCleaned = await this.cleanupTempFiles();

      // 2. Eliminar tasks/ mayores a 30 días
      stats.tasksCleaned = await this.cleanupOldTasks();

      // 3. Calcular uso por tenant y notificar si > 80%
      const tenantsNearQuota = await this.checkQuotaUsage();
      stats.tenantsNotified = tenantsNearQuota;

      // 4. Limpiar archivos expirados de BD
      await workspaceService.cleanupExpiredFiles();

      console.log('Limpieza completada:', stats);
    } catch (error) {
      console.error('Error en limpieza de workspaces:', error);
    }
  }

  /**
   * Limpia archivos temporales de tareas terminadas
   */
  private async cleanupTempFiles(): Promise<number> {
    let cleaned = 0;

    // Encontrar tareas completadas o fallidas
    const completedTasks = await prisma.accomplishTask.findMany({
      where: {
        status: { in: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED] },
      },
      select: { id: true, tenantId: true, workspacePath: true },
    });

    for (const task of completedTasks) {
      try {
        // Buscar archivos TEMP de esta tarea
        const tempFiles = await prisma.workspaceFile.findMany({
          where: {
            taskId: task.id,
            type: FileType.TEMP,
          },
        });

        for (const file of tempFiles) {
          // Eliminar archivo físico
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          // Eliminar de BD
          await prisma.workspaceFile.delete({
            where: { id: file.id },
          });

          cleaned++;
        }
      } catch (error) {
        console.error(`Error limpiando temp de tarea ${task.id}:`, error);
      }
    }

    return cleaned;
  }

  /**
   * Limpia tareas antiguas (más de 30 días)
   */
  private async cleanupOldTasks(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.TASK_RETENTION_DAYS);

    let cleaned = 0;

    // Encontrar tareas antiguas
    const oldTasks = await prisma.accomplishTask.findMany({
      where: {
        completedAt: { lte: cutoffDate },
        status: { in: [TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED] },
      },
      select: { id: true, tenantId: true, workspacePath: true },
    });

    for (const task of oldTasks) {
      try {
        // Eliminar archivos de BD
        await prisma.workspaceFile.deleteMany({
          where: { taskId: task.id },
        });

        // Eliminar directorio físico
        if (task.workspacePath && fs.existsSync(task.workspacePath)) {
          fs.rmSync(task.workspacePath, { recursive: true, force: true });
        }

        // Eliminar tarea de BD
        await prisma.accomplishTask.delete({
          where: { id: task.id },
        });

        cleaned++;
      } catch (error) {
        console.error(`Error limpiando tarea antigua ${task.id}:`, error);
      }
    }

    return cleaned;
  }

  /**
   * Verifica el uso de cuota y notifica si está cerca del límite
   */
  private async checkQuotaUsage(): Promise<string[]> {
    const tenantsToNotify: string[] = [];

    const tenants = await prisma.tenant.findMany();

    for (const tenant of tenants) {
      try {
        const usage = await workspaceService.calculateUsage(tenant.id);

        // Notificar si está por encima del 80%
        if (usage.percentUsed >= 80) {
          tenantsToNotify.push(tenant.id);

          // TODO: Enviar notificación (email, in-app, etc.)
          console.log(
            `Tenant ${tenant.slug} (${tenant.name}) está al ${usage.percentUsed.toFixed(1)}% de su cuota`
          );
        }
      } catch (error) {
        console.error(`Error verificando quota para tenant ${tenant.id}:`, error);
      }
    }

    return tenantsToNotify;
  }

  /**
   * Limpia una tarea específica
   */
  async cleanupTask(taskId: string): Promise<void> {
    await workspaceService.cleanupTaskWorkspace(taskId);
  }

  /**
   * Fuerza la limpieza inmediata
   */
  async forceCleanup(): Promise<any> {
    return await this.runCleanup();
  }

  /**
   * Inicia el servicio de limpieza en background
   */
  startBackgroundService(): void {
    // Ejecutar limpieza cada hora para archivos temporales
    setInterval(async () => {
      await this.cleanupTempFiles();
    }, this.TEMP_CLEANUP_INTERVAL);

    console.log('CleanupService iniciado (limpieza cada hora)');
  }
}

// Singleton instance
export const cleanupService = new CleanupService();
