/**
 * WorkspaceService - Servicio para gestión de workspaces con cuotas
 *
 * Maneja la creación, limpieza y monitoreo de workspaces de tenants
 */

import { PrismaClient, FileType } from '@prisma/client';
import * as path from 'path';
import * as fs from 'fs';

const prisma = new PrismaClient();

export interface WorkspaceUsage {
  tenantId: string;
  userFiles: number;
  tasks: number;
  temp: number;
  total: number;
  quota: number;
  percentUsed: number;
}

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  type: FileType;
  createdAt: Date;
  expiresAt?: Date;
}

export class WorkspaceService {
  private readonly WORKSPACE_BASE = process.env.WORKSPACE_PATH || path.join(process.cwd(), 'storage', 'tenants');
  private readonly TASK_RETENTION_DAYS = 30;

  /**
   * Crea un workspace para una tarea
   */
  async createTaskWorkspace(tenantId: string, taskId: string): Promise<string> {
    const taskPath = this.getTaskPath(tenantId, taskId);

    if (!fs.existsSync(taskPath)) {
      fs.mkdirSync(taskPath, { recursive: true });
    }

    return taskPath;
  }

  /**
   * Obtiene la ruta de archivos de usuario
   */
  getUserFilesPath(tenantId: string): string {
    const userPath = path.join(this.WORKSPACE_BASE, tenantId, 'user-files');

    if (!fs.existsSync(userPath)) {
      fs.mkdirSync(userPath, { recursive: true });
    }

    return userPath;
  }

  /**
   * Obtiene la ruta de una tarea
   */
  getTaskPath(tenantId: string, taskId: string): string {
    return path.join(this.WORKSPACE_BASE, tenantId, 'tasks', taskId);
  }

  /**
   * Obtiene la ruta de archivos temporales
   */
  getTempPath(tenantId: string, taskId: string): string {
    const tempPath = path.join(this.WORKSPACE_BASE, tenantId, 'temp', taskId);

    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true });
    }

    return tempPath;
  }

  /**
   * Limpia el workspace de una tarea
   */
  async cleanupTaskWorkspace(taskId: string): Promise<void> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
      select: { tenantId: true, workspacePath: true },
    });

    if (!task || !task.workspacePath) {
      return;
    }

    // Eliminar archivos de BD
    await prisma.workspaceFile.deleteMany({
      where: {
        taskId,
        type: { in: [FileType.TASK, FileType.TEMP] },
      },
    });

    // Eliminar directorio físico
    if (fs.existsSync(task.workspacePath)) {
      fs.rmSync(task.workspacePath, { recursive: true, force: true });
    }

    // Actualizar uso
    await this.recalculateUsage(task.tenantId);
  }

  /**
   * Calcula el uso de workspace de un tenant
   */
  async calculateUsage(tenantId: string): Promise<WorkspaceUsage> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    select: { quotaMaxStorage: true },
    });

    if (!tenant) {
      throw new Error('Tenant no encontrado');
    }

    const files = await prisma.workspaceFile.findMany({
      where: { tenantId },
    });

    const userFiles = files
      .filter((f) => f.type === FileType.USER)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const tasks = files
      .filter((f) => f.type === FileType.TASK)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const temp = files
      .filter((f) => f.type === FileType.TEMP)
      .reduce((sum, f) => sum + Number(f.size), 0);

    const total = userFiles + tasks + temp;
    const quota = Number(tenant.quotaMaxStorage);

    return {
      tenantId,
      userFiles,
      tasks,
      temp,
      total,
      quota,
      percentUsed: quota > 0 ? (total / quota) * 100 : 0,
    };
  }

  /**
   * Recalcula y actualiza el uso en BD
   */
  async recalculateUsage(tenantId: string): Promise<void> {
    const usage = await this.calculateUsage(tenantId);
    const fileCount = await prisma.workspaceFile.count({
      where: { tenantId },
    });

    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        workspaceUsed: BigInt(usage.total),
        workspaceItems: fileCount,
      },
    });
  }

  /**
   * Lista archivos de un tenant con filtros
   */
  async listFiles(
    tenantId: string,
    type?: FileType,
    search?: string
  ): Promise<FileInfo[]> {
    const where: any = { tenantId };

    if (type) {
      where.type = type;
    }

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    const files = await prisma.workspaceFile.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return files.map((f) => ({
      path: f.path,
      name: f.name,
      size: Number(f.size),
      type: f.type,
      createdAt: f.createdAt,
      expiresAt: f.expiresAt || undefined,
    }));
  }

  /**
   * Elimina un archivo
   */
  async deleteFile(fileId: string, tenantId: string): Promise<void> {
    const file = await prisma.workspaceFile.findFirst({
      where: { id: fileId, tenantId },
    });

    if (!file) {
      throw new Error('Archivo no encontrado');
    }

    // Eliminar archivo físico
    const fullPath = path.join(this.WORKSPACE_BASE, file.path);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    // Eliminar de BD
    await prisma.workspaceFile.delete({
      where: { id: fileId },
    });

    // Recalcular uso
    await this.recalculateUsage(tenantId);
  }

  /**
   * Mueve un archivo de tarea a archivos de usuario
   */
  async moveToUserFiles(taskId: string, filePath: string, tenantId: string): Promise<void> {
    const task = await prisma.accomplishTask.findUnique({
      where: { id: taskId },
      select: { tenantId: true, workspacePath: true },
    });

    if (!task || task.tenantId !== tenantId) {
      throw new Error('Tarea no encontrada');
    }

    const file = await prisma.workspaceFile.findFirst({
      where: { taskId, path: filePath },
    });

    if (!file) {
      throw new Error('Archivo no encontrado en la tarea');
    }

    // Ruta origen
    const sourcePath = path.join(this.WORKSPACE_BASE, file.path);

    // Ruta destino (user-files)
    const userFilesPath = this.getUserFilesPath(tenantId);
    const fileName = path.basename(filePath);
    const destPath = path.join(userFilesPath, fileName);

    // Mover archivo físico
    if (fs.existsSync(sourcePath)) {
      fs.renameSync(sourcePath, destPath);
    }

    // Actualizar BD
    await prisma.workspaceFile.update({
      where: { id: file.id },
      data: {
        type: FileType.USER,
        path: path.join(tenantId, 'user-files', fileName),
        taskId: null,
        expiresAt: null,
      },
    });

    // Recalcular uso
    await this.recalculateUsage(tenantId);
  }

  /**
   * Limpia archivos expirados (job programado)
   */
  async cleanupExpiredFiles(): Promise<void> {
    const now = new Date();

    // Encontrar archivos expirados
    const expiredFiles = await prisma.workspaceFile.findMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    for (const file of expiredFiles) {
      try {
        // Eliminar archivo físico
        const fullPath = path.join(this.WORKSPACE_BASE, file.path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }

        // Eliminar de BD
        await prisma.workspaceFile.delete({
          where: { id: file.id },
        });
      } catch (error) {
        console.error(`Error limpiando archivo ${file.id}:`, error);
      }
    }

    // Recalcular uso de tenants afectados
    const affectedTenants = [...new Set(expiredFiles.map((f) => f.tenantId))];
    for (const tenantId of affectedTenants) {
      await this.recalculateUsage(tenantId).catch((error) => {
        console.error(`Error recalculando uso para tenant ${tenantId}:`, error);
      });
    }
  }

  /**
   * Registra un archivo en BD
   */
  async registerFile(
    tenantId: string,
    taskId: string | null,
    type: FileType,
    filePath: string,
    fileName: string,
    fileSize: number,
    expiresAt: Date | null = null
  ): Promise<void> {
    await prisma.workspaceFile.create({
      data: {
        id: undefined, // Prisma generará el UUID automáticamente
        tenantId,
        taskId,
        type,
        path: filePath,
        name: fileName,
        size: BigInt(fileSize),
        expiresAt,
      },
    });

    // Recalcular uso
    await this.recalculateUsage(tenantId);
  }
}

// Singleton instance
export const workspaceService = new WorkspaceService();
