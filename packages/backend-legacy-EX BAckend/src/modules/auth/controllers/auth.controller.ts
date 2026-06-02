import { Request, Response } from 'express';
import { prisma } from '../../../config/database';
import { JwtService } from '../services/jwt.service';
import bcrypt from 'bcrypt';

const jwtService = new JwtService();

// Extender Request para incluir user
interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    tenantId: string;
    role: string;
  };
}

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password, tenantSlug } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await prisma.user.findUnique({
        where: { email },
        include: {
          tenants: {
            include: {
              tenant: true
            }
          }
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Si hay múltiples tenants, necesitamos saber cuál usar
      let tenantUser = user.tenants[0];

      if (tenantSlug) {
        const found = user.tenants.find(t => t.tenant.slug === tenantSlug);
        if (found) {
          tenantUser = found;
        }
      }

      if (!tenantUser) {
        return res.status(400).json({ error: 'User has no tenant associated' });
      }

      const token = jwtService.generateToken(user.id, tenantUser.tenantId, tenantUser.role);
      const refreshToken = jwtService.generateRefreshToken(user.id);

      // Serializar tenant sin campos BigInt
      const tenant = tenantUser.tenant as any;
      const safeTenant = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        subscriptionTier: tenant.subscriptionTier,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      };

      res.json({
        token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: tenantUser.role,
          tenantId: tenantUser.tenantId,
          tenant: safeTenant,
          tenants: user.tenants.map(t => ({
            id: t.tenantId,
            name: t.tenant.name,
            slug: t.tenant.slug,
            role: t.role
          }))
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name, tenantName, tenantSlug } = req.body;

      if (!email || !password || !name || !tenantName || !tenantSlug) {
        return res.status(400).json({ error: 'All fields are required' });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already registered' });
      }

      const existingTenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (existingTenant) {
        return res.status(400).json({ error: 'Tenant slug already taken' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            slug: tenantSlug
          }
        });

        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            name,
            tenants: {
              create: {
                tenantId: tenant.id,
                role: 'OWNER'
              }
            }
          },
          include: {
            tenants: {
              include: {
                tenant: true
              }
            }
          }
        });

        return { user, tenant };
      });

      const tenantUser = result.user.tenants[0];
      const token = jwtService.generateToken(result.user.id, tenantUser.tenantId, tenantUser.role);
      const refreshToken = jwtService.generateRefreshToken(result.user.id);

      // Serializar tenant sin campos BigInt
      const tenant = result.tenant as any;
      const safeTenant = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        email: tenant.email,
        subscriptionTier: tenant.subscriptionTier,
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
      };

      res.status(201).json({
        token,
        refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: tenantUser.role,
          tenantId: tenantUser.tenantId,
          tenant: safeTenant
        }
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async refreshToken(req: Request, res: Response) {
    try {
      const { refreshToken, tenantId } = req.body;

      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' });
      }

      const decoded = jwtService.verifyRefreshToken(refreshToken);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          tenants: {
            include: {
              tenant: true
            }
          }
        }
      });

      if (!user) {
        return res.status(401).json({ error: 'Invalid refresh token' });
      }

      // Usar el tenantId proporcionado o el primero disponible
      let tenantUser = user.tenants[0];
      if (tenantId) {
        const found = user.tenants.find(t => t.tenantId === tenantId);
        if (found) {
          tenantUser = found;
        }
      }

      if (!tenantUser) {
        return res.status(400).json({ error: 'User has no tenant associated' });
      }

      const newToken = jwtService.generateToken(user.id, tenantUser.tenantId, tenantUser.role);
      const newRefreshToken = jwtService.generateRefreshToken(user.id);

      res.json({
        token: newToken,
        refreshToken: newRefreshToken
      });
    } catch (error) {
      console.error('Refresh token error:', error);
      res.status(401).json({ error: 'Invalid refresh token' });
    }
  }

  async me(req: Request, res: Response) {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      const tenantId = authReq.user?.tenantId;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          tenants: {
            where: tenantId ? { tenantId } : undefined,
            include: {
              tenant: true
            }
          }
        }
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const tenantUser = user.tenants[0];

      res.json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: tenantUser?.role,
        tenantId: tenantUser?.tenantId,
        tenant: tenantUser?.tenant,
        tenants: user.tenants.map(t => ({
          id: t.tenantId,
          name: t.tenant.name,
          slug: t.tenant.slug,
          role: t.role
        })),
        createdAt: user.createdAt
      });
    } catch (error) {
      console.error('Me error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async switchTenant(req: Request, res: Response) {
    try {
      const authReq = req as AuthenticatedRequest;
      const userId = authReq.user?.userId;
      const { tenantId } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!tenantId) {
        return res.status(400).json({ error: 'Tenant ID is required' });
      }

      const tenantUser = await prisma.tenantUser.findUnique({
        where: {
          tenantId_userId: {
            tenantId,
            userId
          }
        },
        include: {
          tenant: true
        }
      });

      if (!tenantUser) {
        return res.status(403).json({ error: 'Access denied to this tenant' });
      }

      const token = jwtService.generateToken(userId, tenantId, tenantUser.role);
      const refreshToken = jwtService.generateRefreshToken(userId);

      res.json({
        token,
        refreshToken,
        tenant: {
          id: tenantUser.tenantId,
          name: tenantUser.tenant.name,
          slug: tenantUser.tenant.slug,
          role: tenantUser.role
        }
      });
    } catch (error) {
      console.error('Switch tenant error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}
