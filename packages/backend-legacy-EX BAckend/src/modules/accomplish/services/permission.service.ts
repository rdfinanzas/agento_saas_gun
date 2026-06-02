/**
 * PermissionService - Servicio para gestionar permisos de herramientas
 *
 * Este servicio maneja el flujo de solicitud y respuesta de permisos
 * cuando el agente necesita ejecutar acciones potencialmente peligrosas
 */

import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

import {
  PermissionRequestDto,
  PermissionResponseDto,
} from '../dto/accomplish.dto';

const prisma = new PrismaClient();

// EventEmitter para solicitudes de permiso
const permissionEmitter = new EventEmitter();

interface PendingPermission {
  id: string;
  taskId: string;
  tenantId: string;
  type: 'tool' | 'question' | 'custom';
  toolName?: string;
  description: string;
  options?: string[];
  timeout: number;
  createdAt: Date;
  resolve: (response: PermissionResponseDto) => void;
  timer: NodeJS.Timeout;
}

export class PermissionService {
  private pendingPermissions: Map<string, PendingPermission> = new Map();
  private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5 minutos

  /**
   * Solicita permiso al usuario (espera respuesta)
   */
  async requestPermission(
    tenantId: string,
    taskId: string,
    request: Omit<PermissionRequestDto, 'id' | 'createdAt'>
  ): Promise<PermissionResponseDto> {
    // Verificar si el tenant tiene auto-approve configurado
    const autoApprove = await this.getAutoApproveConfig(tenantId, request);
    if (autoApprove) {
      return { decision: 'allow' };
    }

    return new Promise((resolve, reject) => {
      const id = uuidv4();
      const timeout = request.timeout || this.DEFAULT_TIMEOUT;

      // Crear pendiente
      const pending: PendingPermission = {
        id,
        taskId,
        tenantId,
        type: request.type,
        toolName: request.toolName,
        description: request.description,
        options: request.options,
        timeout,
        createdAt: new Date(),
        resolve,
        timer: setTimeout(() => {
          this.pendingPermissions.delete(id);
          reject(new Error('Timeout de permiso'));
        }, timeout),
      };

      this.pendingPermissions.set(id, pending);

      // Emitir evento para SSE
      this.emitPermissionRequest(pending);
    });
  }

  /**
   * Responde a una solicitud de permiso
   */
  async respond(requestId: string, response: PermissionResponseDto): Promise<void> {
    const pending = this.pendingPermissions.get(requestId);

    if (!pending) {
      throw new Error('Solicitud de permiso no encontrada o expirada');
    }

    // Limpiar timeout
    clearTimeout(pending.timer);

    // Resolver promesa
    pending.resolve(response);

    // Eliminar pendiente
    this.pendingPermissions.delete(requestId);
  }

  /**
   * Obtiene la configuración de permisos por defecto de un tenant
   */
  async getDefaultPermissions(tenantId: string): Promise<any> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { settings: true },
    });

    const settings = tenant?.settings as any;
    return settings?.accomplish?.permissions || {
      // Configuración por defecto
      autoApprove: [],
      alwaysDeny: [],
      requireApproval: ['bash', 'write', 'edit', 'task'],
    };
  }

  /**
   * Actualiza la configuración de permisos de un tenant
   */
  async updateDefaultPermissions(tenantId: string, config: any): Promise<void> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error('Tenant no encontrado');
    }

    const currentSettings = (tenant.settings as any) || {};
    const updatedSettings = {
      ...currentSettings,
      accomplish: {
        ...(currentSettings.accomplish || {}),
        permissions: config,
      },
    };

    await prisma.tenant.update({
      where: { id: tenantId },
      data: { settings: updatedSettings },
    });
  }

  /**
   * Obtiene una solicitud de permiso pendiente
   */
  getPendingPermission(requestId: string): PendingPermission | undefined {
    return this.pendingPermissions.get(requestId);
  }

  /**
   * Obtiene todas las solicitudes pendientes de un tenant
   */
  getTenantPendingPermissions(tenantId: string): PendingPermission[] {
    return Array.from(this.pendingPermissions.values()).filter(
      (p) => p.tenantId === tenantId
    );
  }

  /**
   * Cancela una solicitud de permiso
   */
  cancelPermission(requestId: string): void {
    const pending = this.pendingPermissions.get(requestId);
    if (pending) {
      clearTimeout(pending.timer);
      this.pendingPermissions.delete(requestId);
    }
  }

  /**
   * Verifica si una herramienta debe tener auto-approve
   */
  private async getAutoApproveConfig(
    tenantId: string,
    request: Omit<PermissionRequestDto, 'id' | 'createdAt'>
  ): Promise<boolean> {
    const config = await this.getDefaultPermissions(tenantId);

    // Si está en alwaysDeny, nunca auto-aprobar
    if (config.alwaysDeny?.includes(request.toolName || '')) {
      return false;
    }

    // Si está en autoApprove, aprobar automáticamente
    if (config.autoApprove?.includes(request.toolName || '')) {
      return true;
    }

    // Herramientas seguras que no requieren permiso
    const safeTools = ['read', 'glob', 'grep', 'list', 'knowledge_query'];
    if (safeTools.includes(request.toolName || '')) {
      return true;
    }

    return false;
  }

  /**
   * Emite evento de solicitud de permiso (para SSE)
   */
  private emitPermissionRequest(pending: PendingPermission): void {
    // Este evento será capturado por el controlador SSE
    permissionEmitter.emit('permission:request', {
      id: pending.id,
      taskId: pending.taskId,
      tenantId: pending.tenantId,
      type: pending.type,
      toolName: pending.toolName,
      description: pending.description,
      options: pending.options,
      timeout: pending.timeout,
    });
  }

  /**
   * Suscribe a eventos de solicitud de permiso
   */
  onPermissionRequest(callback: (data: any) => void): void {
    permissionEmitter.on('permission:request', callback);
  }

  /**
   * Elimina suscriptor de eventos de permiso
   */
  offPermissionRequest(callback: (data: any) => void): void {
    permissionEmitter.off('permission:request', callback);
  }
}

// Singleton instance
export const permissionService = new PermissionService();

// Exportar el emitter para uso externo
export { permissionEmitter };
