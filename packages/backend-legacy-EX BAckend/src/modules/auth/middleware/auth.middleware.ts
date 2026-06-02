import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Extensión de Request para incluir user info
 */
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
      tenantId?: string;
      userRole?: string;
    }
  }
}

/**
 * Middleware de autenticación
 * Verifica el token JWT y extrae userId, tenantId y role
 */
export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No autorizado',
        message: 'Token de autenticación requerido'
      });
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET no está definido');
      return res.status(500).json({
        error: 'Error de configuración',
        message: 'JWT_SECRET no configurado'
      });
    }

    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
      userId: string;
      tenantId: string;
      role: string;
      email?: string;
    };

    // Agregar info del usuario al request
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    req.tenantId = decoded.tenantId;
    req.userRole = decoded.role;

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        error: 'Token expirado',
        message: 'El token de autenticación ha expirado'
      });
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        error: 'Token inválido',
        message: 'El token de autenticación no es válido'
      });
    }

    console.error('Error en authMiddleware:', error);
    return res.status(500).json({
      error: 'Error interno del servidor',
      message: 'Error al procesar la autenticación'
    });
  }
}

/**
 * Middleware opcional de autenticación
 * No falla si no hay token, pero agrega la info si existe
 */
export async function optionalAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      return next();
    }

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

    next();
  } catch (error) {
    // Ignorar errores en auth opcional
    next();
  }
}
