/**
 * Security Middleware - Middleware de seguridad para Accomplish
 *
 * Implementa rate limiting, timeouts y validaciones de seguridad
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Store para rate limiting en memoria (en producción usar Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 10, // 10 tareas
  windowMs: 60 * 60 * 1000, // por hora
};

const MAX_TASK_TIMEOUT = 15 * 60 * 1000; // 15 minutos máximo
const MAX_TOKENS_PER_TASK = 100000; // Límite de tokens por tarea

// Herramientas peligrosas que requieren validación adicional
const DANGEROUS_TOOLS = ['bash', 'write', 'edit', 'task', 'execute_code'];

// Comandos peligrosos que no deben ejecutarse
const FORBIDDEN_COMMANDS = [
  'rm -rf /',
  'mkfs',
  'dd if=/dev/zero',
  'chmod 000',
  'chown -R',
  ':(){ :|:& };:', // Fork bomb
  'wget',
  'curl',
  'nc -l',
  'netcat',
];

/**
 * Middleware de rate limiting para creación de tareas
 */
export function accomplishRateLimit(req: Request, res: Response, next: NextFunction): void {
  const tenantId = req.tenantId!;
  const now = Date.now();

  // Obtener configuración del tenant
  getRateLimitConfig(tenantId).then((config) => {
    const key = `accomplish:${tenantId}`;
    const record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      // Primer request o ventana expirada
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      next();
      return;
    }

    if (record.count >= config.maxRequests) {
      const resetTime = new Date(record.resetTime).toISOString();
      res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader('X-RateLimit-Reset', resetTime);
      res.status(429).json({
        error: 'Demasiadas tareas. Por favor, espera antes de crear otra.',
        retryAfter: new Date(record.resetTime),
      });
      return;
    }

    record.count++;
    res.setHeader('X-RateLimit-Limit', config.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', (config.maxRequests - record.count).toString());
    res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());
    next();
  });
}

/**
 * Middleware de validación de prompts
 */
export function validatePrompt(req: Request, res: Response, next: NextFunction): void {
  const { prompt } = req.body;

  if (!prompt) {
    res.status(400).json({ error: 'El prompt es requerido' });
    return;
  }

  // Validar longitud
  if (prompt.length > 50000) {
    res.status(400).json({ error: 'El prompt es demasiado largo (máximo 50000 caracteres)' });
    return;
  }

  // Validar que no contenga comandos peligrosos obvios
  const lowerPrompt = prompt.toLowerCase();
  for (const forbidden of FORBIDDEN_COMMANDS) {
    if (lowerPrompt.includes(forbidden)) {
      res.status(400).json({
        error: 'El prompt contiene comandos no permitidos por razones de seguridad',
      });
      return;
    }
  }

  next();
}

/**
 * Middleware de validación de timeout
 */
export function validateTaskTimeout(req: Request, res: Response, next: NextFunction): void {
  const { timeout } = req.body;

  if (timeout !== undefined) {
    if (typeof timeout !== 'number' || timeout <= 0) {
      res.status(400).json({ error: 'El timeout debe ser un número positivo' });
      return;
    }

    if (timeout > MAX_TASK_TIMEOUT) {
      res.status(400).json({
        error: `El timeout no puede exceder ${MAX_TASK_TIMEOUT / 1000 / 60} minutos`,
      });
      return;
    }
  }

  next();
}

/**
 * Middleware de validación de aislamiento de workspace
 */
export function validateWorkspaceIsolation(req: Request, res: Response, next: NextFunction): void {
  const { workspacePath } = req.body;

  if (workspacePath) {
    // Validar que el path sea relativo y no intente escapar
    if (workspacePath.includes('..') || workspacePath.startsWith('/')) {
      res.status(400).json({ error: 'Path de workspace inválido' });
      return;
    }
  }

  next();
}

/**
 * Middleware de validación de herramientas
 */
export function validateToolUsage(req: Request, res: Response, next: NextFunction): void {
  const { tools } = req.body;

  if (tools) {
    if (!Array.isArray(tools)) {
      res.status(400).json({ error: 'Tools debe ser un array' });
      return;
    }

    // Validar que no haya herramientas peligrosas sin permiso explícito
    const hasDangerousTools = tools.some((t: string) => DANGEROUS_TOOLS.includes(t));
    if (hasDangerousTools && !req.body.explicitPermission) {
      res.status(400).json({
        error: 'El uso de herramientas peligrosas requiere permiso explícito',
        dangerousTools: tools.filter((t: string) => DANGEROUS_TOOLS.includes(t)),
      });
      return;
    }
  }

  next();
}

/**
 * Middleware de validación de tamaño de archivos
 */
export function validateFileSize(req: Request, res: Response, next: NextFunction): void {
  const maxFileSize = 10 * 1024 * 1024; // 10 MB

  // Si hay archivos en la request
  if (req.file) {
    if (req.file.size > maxFileSize) {
      res.status(400).json({
        error: `El archivo es demasiado grande (máximo ${maxFileSize / 1024 / 1024} MB)`,
      });
      return;
    }
  }

  next();
}

/**
 * Limpia registros de rate limit antiguos
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();

  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Ejecutar limpieza cada hora
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);

/**
 * Obtiene la configuración de rate limit de un tenant
 */
async function getRateLimitConfig(tenantId: string): Promise<RateLimitConfig> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subscriptionTier: true, settings: true },
    });

    if (!tenant) {
      return DEFAULT_RATE_LIMIT;
    }

    // Planes PRO y ENTERPRISE tienen límites más altos
    switch (tenant.subscriptionTier) {
      case 'ENTERPRISE':
        return { maxRequests: 100, windowMs: 60 * 60 * 1000 };
      case 'PRO':
        return { maxRequests: 50, windowMs: 60 * 60 * 1000 };
      default:
        return DEFAULT_RATE_LIMIT;
    }
  } catch (error) {
    console.error('Error getting rate limit config:', error);
    return DEFAULT_RATE_LIMIT;
  }
}
