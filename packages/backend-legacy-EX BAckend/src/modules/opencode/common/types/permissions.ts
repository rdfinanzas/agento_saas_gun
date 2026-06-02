/**
 * Tipos para el sistema de Permisos
 * Adaptado desde Accomplish Agent-Core
 */

// Operaciones que requieren permiso
export type PermissionOperation =
  | 'file_read'
  | 'file_write'
  | 'file_overwrite'
  | 'file_delete'
  | 'file_create'
  | 'execute'
  | 'network'
  | 'api_call';

// Solicitud de permiso
export interface PermissionRequest {
  id: string;
  taskId: string;
  tenantId: string;
  operation: PermissionOperation;
  resource: string;
  details?: string;
  contentPreview?: string;
  targetPath?: string;
  filePaths?: string[];
  createdAt: Date;
}

// Respuesta de permiso
export interface PermissionResponse {
  requestId: string;
  granted: boolean;
  reason?: string;
  respondedAt: Date;
  respondedBy?: string; // userId
}

// Regla de permiso persistente
export interface PermissionRule {
  id: string;
  tenantId: string;
  operation: PermissionOperation;
  pattern: string; // glob pattern para recursos
  allowed: boolean;
  createdBy: string;
  createdAt: Date;
}

// Opciones del PermissionHandler
export interface PermissionHandlerOptions {
  defaultAllowRead?: boolean;
  defaultAllowExecute?: boolean;
  requireApprovalForDelete?: boolean;
  requireApprovalForWrite?: boolean;
}

// DTOs para API
export class RequestPermissionDto {
  operation!: PermissionOperation;
  resource!: string;
  details?: string;
  contentPreview?: string;
  targetPath?: string;
  filePaths?: string[];
}

export class RespondPermissionDto {
  requestId!: string;
  granted!: boolean;
  reason?: string;
}

export class PermissionRuleDto {
  operation!: PermissionOperation;
  pattern!: string;
  allowed!: boolean;
}

// Estado de permisos pendientes
export class PendingPermissionsDto {
  pending!: PermissionRequest[];
  total!: number;
}
