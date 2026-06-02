import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../../config/database';

declare global {
  namespace Express {
    interface Request {
      tenant?: any;
      tenantId?: string;
    }
  }
}

export async function tenantMiddleware(req: Request, res: Response, next: NextFunction) {
  const tenantSlug = req.params.tenantSlug || req.headers['x-tenant-slug'] as string;

  if (!tenantSlug) {
    return res.status(400).json({ error: 'Tenant requerido' });
  }

  try {
    const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant no encontrado' });
    }
    req.tenant = tenant;
    req.tenantId = tenant.id;
    next();
  } catch (error) {
    return res.status(500).json({ error: 'Error al verificar tenant' });
  }
}

export function requireAuthAndTenant(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Autenticacion requerida' });
  if (!req.tenant) return res.status(400).json({ error: 'Tenant requerido' });
  next();
}
