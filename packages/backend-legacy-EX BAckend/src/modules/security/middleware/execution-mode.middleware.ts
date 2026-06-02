/**
 * Security Middleware - Validaciones de seguridad para Execution Mode
 *
 * Usa @agento/agent-core como única fuente de verdad para permisos.
 */

import { Request, Response, NextFunction } from 'express';
import {
  ExecutionMode,
  LIMITED_MODE_ALLOWED_TOOLS,
  LIMITED_MODE_BLOCKED_TOOLS,
  securityLayer,
} from '@agento/agent-core';

declare global {
  namespace Express {
    interface Request {
      executionMode?: 'FULL' | 'LIMITED';
      allowedTools?: string[];
      blockedTools?: string[];
    }
  }
}

export interface SecurityRule {
  id: string;
  name: string;
  pattern: RegExp;
  action: 'allow' | 'deny';
  description: string;
}

const DEFAULT_BLOCKED_PATTERNS = [
  /rm\s+-rf/i,
  /format\s+c:/i,
  /del\s+\/f\s+\/s/i,
  /mkfs/i,
  /dd\s+if=/i,
  />\s*\/dev\/sda/i,
];

export class SecurityMiddleware {
  private rules: SecurityRule[] = [];

  constructor() {
    this.initializeDefaultRules();
  }

  private initializeDefaultRules(): void {
    this.addRule({
      id: 'block-destroy',
      name: 'Block System Destruction',
      pattern: /rm\s+-rf|format|del\s+\/f|mkfs/,
      action: 'deny',
      description: 'Bloquea comandos que pueden destruir el sistema',
    });

    this.addRule({
      id: 'block-network-sensitive',
      name: 'Block Sensitive Network',
      pattern: /curl.*password|wget.*--password/,
      action: 'deny',
      description: 'Bloquea comandos que envían contraseñas por red',
    });

    this.addRule({
      id: 'allow-read-only',
      name: 'Allow Read Operations',
      pattern: /^(cat|head|tail|ls|find|grep)/,
      action: 'allow',
      description: 'Permite operaciones de lectura',
    });
  }

  addRule(rule: SecurityRule): void {
    this.rules.push(rule);
  }

  removeRule(ruleId: string): void {
    this.rules = this.rules.filter(r => r.id !== ruleId);
  }

  getRules(): SecurityRule[] {
    return [...this.rules];
  }

  validateCommand(command: string): { allowed: boolean; reason?: string } {
    // Usar securityLayer de agent-core
    const mode = ExecutionMode.LIMITED; // Default a LIMITED para comandos
    return securityLayer.validateCommand(command, mode);
  }

  executionModeMiddleware(req: Request, res: Response, next: NextFunction): void {
    const userRole = req.userRole;
    const tenantId = req.tenantId;

    if (userRole === 'ADMIN' || userRole === 'OWNER') {
      req.executionMode = 'FULL';
      req.allowedTools = undefined;
      req.blockedTools = [];
    } else {
      req.executionMode = 'LIMITED';
      // Usar constantes de agent-core
      req.allowedTools = [...LIMITED_MODE_ALLOWED_TOOLS];
      req.blockedTools = [...LIMITED_MODE_BLOCKED_TOOLS];
    }

    next();
  }

  validateToolAccess(req: Request, res: Response, next: NextFunction): void {
    const toolName = req.body.toolName || req.query.tool;

    if (req.executionMode === 'FULL') {
      return next();
    }

    // Usar securityLayer de agent-core para validación
    const mode = req.executionMode === 'FULL' ? ExecutionMode.FULL : ExecutionMode.LIMITED;
    const validation = securityLayer.validateTool(String(toolName), mode);

    if (!validation.allowed) {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: validation.reason || `La herramienta ${toolName} no está disponible`,
      });
    }

    next();
  }

  validateWorkspacePath(req: Request, res: Response, next: NextFunction): void {
    const requestedPath = req.params.filePath || req.params.itemPath || req.body.filePath;
    const tenantId = req.tenantId;

    if (!requestedPath) {
      return next();
    }

    // Usar securityLayer de agent-core para validación de paths
    const validation = securityLayer.validatePath(tenantId || 'default', requestedPath);

    if (!validation.allowed) {
      return res.status(403).json({
        error: 'Path no permitido',
        message: validation.reason || 'El path solicitado no es válido',
      });
    }

    // Reemplazar con path sanitizado
    if (validation.sanitizedPath) {
      req.body.filePath = validation.sanitizedPath;
    }

    next();
  }

  rateLimitByTenant(req: Request, res: Response, next: NextFunction): void {
    const tenantId = req.tenantId;

    if (!tenantId) {
      return res.status(401).json({ error: 'Tenant no identificado' });
    }

    next();
  }
}

export const securityMiddleware = new SecurityMiddleware();
