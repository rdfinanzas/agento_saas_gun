/**
 * Admin Middleware - Verifica si el usuario es administrador
 */

import { Request, Response, NextFunction } from 'express';

/**
 * Middleware de verificación de admin
 * Solo permite acceso a usuarios con rol ADMIN u OWNER
 */
export async function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const userRole = req.userRole;
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Autenticación requerida'
      });
    }

    if (userRole !== 'ADMIN' && userRole !== 'OWNER') {
      return res.status(403).json({
        error: 'Acceso denegado',
        message: 'Se requiere rol de administrador'
      });
    }

    next();
  } catch (error) {
    console.error('Error in adminMiddleware:', error);
    return res.status(500).json({
      error: 'Error interno',
      message: 'Error al verificar permisos de administrador'
    });
  }
}
