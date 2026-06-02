/**
 * PermissionHandler - Sistema de permisos para operaciones del agente
 * Adaptado desde Accomplish Agent-Core para multi-tenant
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  PermissionOperation,
  PermissionRequest,
  PermissionResponse,
  PermissionRule,
  PermissionHandlerOptions,
} from '../../common/types/permissions';

/**
 * Handler para solicitudes de permisos.
 * Permite control granular sobre operaciones del agente.
 */
export class PermissionHandler {
  private pendingRequests: Map<string, PermissionRequest> = new Map();
  private rules: Map<string, PermissionRule[]> = new Map(); // por tenant
  private options: PermissionHandlerOptions;

  // Callbacks
  private onRequestCallback?: (request: PermissionRequest) => void;

  constructor(options: PermissionHandlerOptions = {}) {
    this.options = {
      defaultAllowRead: options.defaultAllowRead ?? true,
      defaultAllowExecute: options.defaultAllowExecute ?? false,
      requireApprovalForDelete: options.requireApprovalForDelete ?? true,
      requireApprovalForWrite: options.requireApprovalForWrite ?? false,
    };
  }

  /**
   * Configura callback para nuevas solicitudes
   */
  onRequest(callback: (request: PermissionRequest) => void): void {
    this.onRequestCallback = callback;
  }

  /**
   * Solicita permiso para una operación
   */
  async requestPermission(
    tenantId: string,
    operation: PermissionOperation,
    resource: string,
    details?: string,
    contentPreview?: string,
    targetPath?: string,
    filePaths?: string[]
  ): Promise<PermissionResponse> {
    const requestId = uuidv4();

    const request: PermissionRequest = {
      id: requestId,
      taskId: 'default', // TaskId por defecto, debería pasarse como parámetro
      tenantId,
      operation,
      resource,
      details,
      contentPreview: contentPreview?.substring(0, 500),
      targetPath,
      filePaths,
      createdAt: new Date(),
    };

    // Verificar si hay reglas que aplican
    const applicableRule = this.findApplicableRule(tenantId, operation, resource);
    if (applicableRule) {
      console.log(`[PermissionHandler] Rule found for ${operation} on ${resource}: ${applicableRule.allowed ? 'allowed' : 'denied'}`);
      return {
        requestId,
        granted: applicableRule.allowed,
        reason: applicableRule.allowed ? 'Allowed by rule' : 'Denied by rule',
        respondedAt: new Date(),
      };
    }

    // Verificar políticas por defecto
    const defaultResponse = this.applyDefaultPolicy(operation, resource);
    if (defaultResponse !== null) {
      console.log(`[PermissionHandler] Default policy for ${operation}: ${defaultResponse ? 'allowed' : 'needs approval'}`);
      if (defaultResponse) {
        return {
          requestId,
          granted: true,
          reason: 'Allowed by default policy',
          respondedAt: new Date(),
        };
      }
      // Si no está permitido por defecto, requiere aprobación
    }

    // Requiere aprobación del usuario
    this.pendingRequests.set(requestId, request);

    // Notificar callback
    if (this.onRequestCallback) {
      this.onRequestCallback(request);
    }

    console.log(`[PermissionHandler] Permission request pending: ${requestId} for ${operation}`);

    // Esperar respuesta (con timeout)
    return this.waitForResponse(requestId);
  }

  /**
   * Aplica política por defecto según operación
   */
  private applyDefaultPolicy(operation: PermissionOperation, resource: string): boolean | null {
    switch (operation) {
      case 'file_read':
        return this.options.defaultAllowRead ?? true;

      case 'execute':
        return this.options.defaultAllowExecute ?? false;

      case 'file_delete':
        return this.options.requireApprovalForDelete ? null : false;

      case 'file_write':
      case 'file_create':
      case 'file_overwrite':
        return this.options.requireApprovalForWrite ? null : true;

      case 'network':
        return null; // Siempre requiere aprobación

      default:
        return null;
    }
  }

  /**
   * Busca regla aplicable
   */
  private findApplicableRule(
    tenantId: string,
    operation: PermissionOperation,
    resource: string
  ): PermissionRule | null {
    const tenantRules = this.rules.get(tenantId) || [];

    for (const rule of tenantRules) {
      if (rule.operation === operation && this.matchesPattern(resource, rule.pattern)) {
        return rule;
      }
    }

    return null;
  }

  /**
   * Verifica si un recurso coincide con un patrón glob
   */
  private matchesPattern(resource: string, pattern: string): boolean {
    // Convertir patrón glob a regex simple
    const regex = new RegExp(
      '^' + pattern
        .replace(/\*\*/g, '.*')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]') + '$'
    );
    return regex.test(resource);
  }

  /**
   * Espera respuesta del usuario
   */
  private async waitForResponse(requestId: string): Promise<PermissionResponse> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        // Timeout: denegar por defecto
        this.pendingRequests.delete(requestId);
        resolve({
          requestId,
          granted: false,
          reason: 'Request timed out',
          respondedAt: new Date(),
        });
      }, 300000); // 5 minutos

      // Verificar periódicamente si hay respuesta
      const checkInterval = setInterval(() => {
        // La respuesta se maneja vía respondToRequest
        if (!this.pendingRequests.has(requestId)) {
          clearTimeout(timeout);
          clearInterval(checkInterval);
        }
      }, 1000);
    });
  }

  /**
   * Responde a una solicitud de permiso
   */
  respondToRequest(requestId: string, granted: boolean, reason?: string, userId?: string): boolean {
    const request = this.pendingRequests.get(requestId);
    if (!request) {
      console.warn(`[PermissionHandler] Request not found: ${requestId}`);
      return false;
    }

    this.pendingRequests.delete(requestId);

    const response: PermissionResponse = {
      requestId,
      granted,
      reason,
      respondedAt: new Date(),
      respondedBy: userId,
    };

    // Guardar respuesta para que waitForResponse la pueda resolver
    this.lastResponse = response;

    console.log(`[PermissionHandler] Request ${requestId} ${granted ? 'approved' : 'denied'}`);
    return true;
  }

  private lastResponse: PermissionResponse | null = null;

  /**
   * Obtiene solicitudes pendientes
   */
  getPendingRequests(tenantId?: string): PermissionRequest[] {
    const requests = Array.from(this.pendingRequests.values());
    if (tenantId) {
      return requests.filter(r => r.tenantId === tenantId);
    }
    return requests;
  }

  /**
   * Agrega una regla de permiso
   */
  addRule(tenantId: string, rule: Omit<PermissionRule, 'id' | 'tenantId' | 'createdAt'>): PermissionRule {
    const tenantRules = this.rules.get(tenantId) || [];

    const newRule: PermissionRule = {
      id: uuidv4(),
      tenantId,
      ...rule,
      createdAt: new Date(),
    };

    tenantRules.push(newRule);
    this.rules.set(tenantId, tenantRules);

    console.log(`[PermissionHandler] Rule added: ${rule.operation} ${rule.pattern} = ${rule.allowed}`);
    return newRule;
  }

  /**
   * Elimina una regla
   */
  removeRule(tenantId: string, ruleId: string): boolean {
    const tenantRules = this.rules.get(tenantId) || [];
    const index = tenantRules.findIndex(r => r.id === ruleId);

    if (index === -1) return false;

    tenantRules.splice(index, 1);
    this.rules.set(tenantId, tenantRules);

    return true;
  }

  /**
   * Obtiene reglas de un tenant
   */
  getRules(tenantId: string): PermissionRule[] {
    return this.rules.get(tenantId) || [];
  }

  /**
   * Limpia solicitudes expiradas
   */
  cleanupExpiredRequests(maxAgeMs: number = 600000): void {
    const now = Date.now();
    for (const [id, request] of this.pendingRequests.entries()) {
      if (now - request.createdAt.getTime() > maxAgeMs) {
        this.pendingRequests.delete(id);
        console.log(`[PermissionHandler] Cleaned up expired request: ${id}`);
      }
    }
  }
}

// Singleton
let permissionHandlerInstance: PermissionHandler | null = null;

export function getPermissionHandler(options?: PermissionHandlerOptions): PermissionHandler {
  if (!permissionHandlerInstance) {
    permissionHandlerInstance = new PermissionHandler(options);
  }
  return permissionHandlerInstance;
}

export function createPermissionHandler(options?: PermissionHandlerOptions): PermissionHandler {
  return new PermissionHandler(options);
}
