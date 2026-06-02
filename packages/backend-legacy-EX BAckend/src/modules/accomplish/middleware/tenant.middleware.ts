/**
 * Tenant Middleware - Middleware para extracción de tenantId desde ruta o header
 *
 * Para rutas que incluyen :tenant como parámetro, extrae y valida el tenant
 * También soporta x-tenant-slug header para compatibilidad con el frontend
 */

import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Middleware que extrae el tenantId del parámetro de ruta o header
 * y lo agrega al request para uso posterior
 */
export async function tenantFromParamsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Debug logging
    console.log('[tenantFromParamsMiddleware] URL:', req.url);
    console.log('[tenantFromParamsMiddleware] baseUrl:', req.baseUrl);
    console.log('[tenantFromParamsMiddleware] originalUrl:', req.originalUrl);
    console.log('[tenantFromParamsMiddleware] params:', req.params);
    console.log('[tenantFromParamsMiddleware] headers x-tenant-slug:', req.headers['x-tenant-slug']);

    // Intentar obtener tenant de parámetro de ruta primero
    let tenantSlug = req.params.tenant;

    // Si no está en params, intentar obtener del header
    if (!tenantSlug) {
      tenantSlug = req.headers['x-tenant-slug'] as string;
    }

    // Si todavía no hay tenant, intentar extraerlo de la URL o baseUrl
    if (!tenantSlug) {
      // Extraer de la URL original: /api/v1/tenant/accomplish/tasks
      const urlMatch = req.originalUrl?.match(/\/api\/v1\/([^\/]+)/);
      if (urlMatch) {
        tenantSlug = urlMatch[1];
      }
    }

    if (!tenantSlug) {
      res.status(400).json({
        error: 'Tenant requerido',
        message: 'El parámetro tenant es obligatorio'
      });
      return;
    }

    // Buscar tenant por slug o ID
    const foundTenant = await prisma.tenant.findFirst({
      where: {
        OR: [
          { slug: tenantSlug },
          { id: tenantSlug }
        ]
      },
      select: {
        id: true,
        slug: true,
        name: true,
        subscriptionTier: true
      }
    });

    if (!foundTenant) {
      res.status(404).json({
        error: 'Tenant no encontrado',
        message: `No se encontró el tenant "${tenantSlug}"`
      });
      return;
    }

    // Agregar tenantId al request (ya sea desde auth o desde params)
    req.tenantId = req.tenantId || foundTenant.id;

    // Verificar que el tenant del token coincide con el de la ruta (si hay auth)
    if (req.tenantId && req.tenantId !== foundTenant.id) {
      res.status(403).json({
        error: 'Acceso denegado',
        message: 'No tienes acceso a este tenant'
      });
      return;
    }

    // Agregar info del tenant al request
    (req as any).tenant = foundTenant;

    next();
  } catch (error) {
    console.error('Error en tenantFromParamsMiddleware:', error);
    res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al procesar la solicitud'
    });
  }
}

/**
 * Middleware combinado: Auth + Tenant de params
 */
export async function authWithTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Primero ejecutar authMiddleware (importado)
  // Luego tenantFromParamsMiddleware
  // Pero como Express no soporta esto directamente, lo hacemos manualmente

  try {
    const authHeader = req.headers.authorization;
    const jwt = require('jsonwebtoken');

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];

      if (process.env.JWT_SECRET) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
          userId: string;
          tenantId: string;
          role: string;
          email?: string;
        };

        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        req.tenantId = decoded.tenantId;
        req.userRole = decoded.role;
      }
    }

    // Luego extraer tenant de params
    await tenantFromParamsMiddleware(req, res, next);
  } catch (error: any) {
    // Si falla la auth, intentar continuar con tenant de params
    if (error.name === 'TokenExpiredError' || error.name === 'JsonWebTokenError') {
      await tenantFromParamsMiddleware(req, res, next);
    } else {
      res.status(500).json({
        error: 'Error interno del servidor',
        message: 'Error al procesar la autenticación'
      });
    }
  }
}
