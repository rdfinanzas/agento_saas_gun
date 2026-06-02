import 'express';
import type { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      /**
       * ID del tenant actual (extraído del token JWT o middleware)
       */
      tenantId?: string;

      /**
       * ID del usuario autenticado (extraído del middleware de auth)
       */
      userId?: string;

      /**
       * Información completa del usuario autenticado
       */
      user?: {
        userId: string;
        id?: string;
        tenantId: string;
        role: string;
        name?: string;
        email?: string;
      };
    }
  }
}

// Exportar tipos para uso directo en controllers
// Express.Request ya incluye params, query, body por defecto
export type AuthenticatedRequest = Request;

export {};
