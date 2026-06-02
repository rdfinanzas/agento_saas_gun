/**
 * Admin Controller - Gestión administrativa del SaaS
 */

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { SecureStorage } from '../opencode/internal/classes/SecureStorage';
import { validateApiKeys, validateApiKey } from './api-key-validation';

const prisma = new PrismaClient();

// Inicializar SecureStorage para API keys globales
const secureStorage = new SecureStorage({
  storagePath: process.env.SECURE_STORAGE_PATH || './secure-storage',
  appId: 'agento-saas-global',
  fileName: 'global-api-keys.json',
});

export class AdminController {
  private secureStorage = secureStorage;
  /**
   * Obtiene estadísticas globales del sistema
   */
async getStats(req: Request, res: Response): Promise<void> {
    try {
      const [
        totalTenants,
        totalUsers,
        totalConversations,
        totalMessages,
        activeSubscriptions,
      ] = await Promise.all([
        prisma.tenant.count(),
        prisma.user.count(),
        prisma.conversation.count(),
        prisma.message.count(),
        prisma.subscription.count({
          where: { status: 'ACTIVE' },
        }),
      ]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const messagesToday = await prisma.message.count({
        where: {
          createdAt: { gte: today },
        },
      });

      res.json({
        totalTenants,
        totalUsers,
        totalConversations,
        totalMessages,
        activeSubscriptions,
        messagesToday,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista todos los tenants con información
   */
  async listTenants(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [tenants, total] = await Promise.all([
        prisma.tenant.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            users: {
              include: { user: true },
            },
            subscription: true,
            _count: {
              select: {
                conversations: true,
                whatsappConfigs: true,
              },
            },
          },
        }),
        prisma.tenant.count(),
      ]);

      res.json({
        tenants: tenants.map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
          email: t.email,
          subscriptionTier: t.subscriptionTier,
          createdAt: t.createdAt,
          usersCount: t.users.length,
          conversationsCount: t._count.conversations,
          agentsCount: t._count.whatsappConfigs,
          subscriptionStatus: t.subscription?.status || null,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene detalles de un tenant específico
   */
  async getTenantDetails(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;

      const tenant = await prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          users: {
            include: { user: true },
          },
          subscription: true,
          whatsappConfigs: true,
          conversations: {
            take: 10,
            orderBy: { lastMessageAt: 'desc' },
          },
          usages: {
            take: 30,
            orderBy: { date: 'desc' },
          },
        },
      });

      if (!tenant) {
        res.status(404).json({ error: 'Tenant no encontrado' });
        return;
      }

      res.json({
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        email: tenant.email,
        subscriptionTier: tenant.subscriptionTier,
        createdAt: tenant.createdAt,
        settings: tenant.settings,
        users: tenant.users.map((u) => ({
          id: u.user.id,
          email: u.user.email,
          name: u.user.name,
          role: u.role,
        })),
        subscription: tenant.subscription,
        whatsappAgents: tenant.whatsappConfigs.map((c) => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          agentName: c.agentName,
          isActive: c.isActive,
        })),
        recentConversations: tenant.conversations.map((c) => ({
          id: c.id,
          phoneNumber: c.phoneNumber,
          contactName: c.contactName,
          status: c.status,
          lastMessageAt: c.lastMessageAt,
        })),
        usage: tenant.usages,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Actualiza el plan de un tenant
   */
  async updateTenantPlan(req: Request, res: Response): Promise<void> {
    try {
      const { tenantId } = req.params;
      const { plan, action } = req.body;

      if (!['FREE', 'PRO', 'ENTERPRISE'].includes(plan)) {
        res.status(400).json({ error: 'Plan inválido' });
        return;
      }

      const tenant = await prisma.tenant.update({
        where: { id: tenantId },
        data: { subscriptionTier: plan },
      });

      res.json({
        success: true,
        subscriptionTier: tenant.subscriptionTier,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista todos los usuarios del sistema
   */
  async listUsers(req: Request, res: Response): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const skip = (page - 1) * limit;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            tenants: {
              include: { tenant: true },
            },
          },
        }),
        prisma.user.count(),
      ]);

      res.json({
        users: users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          createdAt: u.createdAt,
          tenants: u.tenants.map((t) => ({
            id: t.tenant.id,
            name: t.tenant.name,
            role: t.role,
          })),
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene métricas históricas
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const usages = await prisma.tenantUsage.findMany({
        where: {
          date: { gte: startDate },
        },
        orderBy: { date: 'asc' },
      });

      const metricsByDate: Record<string, any> = {};
      for (const usage of usages) {
        const dateKey = usage.date.toISOString().split('T')[0];
        if (!metricsByDate[dateKey]) {
          metricsByDate[dateKey] = {
            date: dateKey,
            requestsCount: 0,
            whatsappMessages: 0,
          };
        }
        metricsByDate[dateKey].requestsCount += usage.requestsCount;
        metricsByDate[dateKey].whatsappMessages += usage.whatsappMessages;
      }

      res.json({
        metrics: Object.values(metricsByDate),
        period: { days, startDate, endDate: new Date() },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ==================== AI PROVIDERS & MODELS ====================

  /**
   * Lista todos los proveedores de IA con sus modelos (público para usuarios autenticados)
   */
  async listPublicAIProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = await prisma.aIProvider.findMany({
        where: { isActive: true },
        include: {
          models: {
            where: { isActive: true },
            orderBy: { displayName: 'asc' },
          },
        },
        orderBy: { displayName: 'asc' },
      });

      // Verificar qué proveedores tienen API key configurada
      const providersWithKeys = await Promise.all(
        providers.map(async (p) => {
          const credential = await this.secureStorage.getApiKey('global', p.provider as any);
          return {
            ...p,
            hasApiKey: !!credential?.apiKey,
          };
        })
      );

      res.json({
        providers: providersWithKeys.map((p) => ({
          id: p.id,
          provider: p.provider,
          displayName: p.displayName,
          description: p.description,
          isActive: p.isActive,
          isDefault: p.isDefault,
          apiKeyName: p.apiKeyName,
          configSchema: p.configSchema,
          hasApiKey: p.hasApiKey,
          models: p.models.map((m) => ({
            id: m.id,
            modelId: m.modelId,
            displayName: m.displayName,
            description: m.description,
            isActive: m.isActive,
            maxTokens: m.maxTokens,
            supportsVision: m.supportsVision,
            supportsTools: m.supportsTools,
            supportsStreaming: m.supportsStreaming,
            costPer1kTokens: m.costPer1kTokens,
          })),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Lista todos los proveedores de IA con sus modelos (admin - incluye inactivos)
   */
  async listAIProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = await prisma.aIProvider.findMany({
        include: {
          models: {
            orderBy: { displayName: 'asc' },
          },
        },
        orderBy: { displayName: 'asc' },
      });

      // Verificar qué proveedores tienen API key configurada
      const providersWithKeys = await Promise.all(
        providers.map(async (p) => {
          const credential = await this.secureStorage.getApiKey('global', p.provider as any);
          return {
            ...p,
            hasApiKey: !!credential?.apiKey,
          };
        })
      );

      res.json({
        providers: providersWithKeys.map((p) => ({
          id: p.id,
          provider: p.provider,
          displayName: p.displayName,
          description: p.description,
          isActive: p.isActive,
          isDefault: p.isDefault,
          apiKeyName: p.apiKeyName,
          configSchema: p.configSchema,
          hasApiKey: p.hasApiKey,
          models: p.models.map((m) => ({
            id: m.id,
            modelId: m.modelId,
            displayName: m.displayName,
            description: m.description,
            isActive: m.isActive,
            maxTokens: m.maxTokens,
            supportsVision: m.supportsVision,
            supportsTools: m.supportsTools,
            supportsStreaming: m.supportsStreaming,
            costPer1kTokens: m.costPer1kTokens,
          })),
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene un proveedor de IA específico
   */
  async getAIProvider(req: Request, res: Response): Promise<void> {
    try {
      const { providerId } = req.params;

      const provider = await prisma.aIProvider.findUnique({
        where: { id: providerId },
        include: {
          models: {
            orderBy: { displayName: 'asc' },
          },
        },
      });

      if (!provider) {
        res.status(404).json({ error: 'Proveedor no encontrado' });
        return;
      }

      res.json({
        id: provider.id,
        provider: provider.provider,
        displayName: provider.displayName,
        description: provider.description,
        isActive: provider.isActive,
        isDefault: provider.isDefault,
        apiKeyName: provider.apiKeyName,
        configSchema: provider.configSchema,
        models: provider.models.map((m) => ({
          id: m.id,
          modelId: m.modelId,
          displayName: m.displayName,
          description: m.description,
          isActive: m.isActive,
          maxTokens: m.maxTokens,
          supportsVision: m.supportsVision,
          supportsTools: m.supportsTools,
          supportsStreaming: m.supportsStreaming,
          costPer1kTokens: m.costPer1kTokens,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea o actualiza un proveedor de IA
   */
  async upsertAIProvider(req: Request, res: Response): Promise<void> {
    try {
      const { providerId } = req.params;
      const {
        provider,
        displayName,
        description,
        isActive,
        isDefault,
        apiKeyName,
        configSchema,
      } = req.body;

      // Si se marca como default, quitar el default de los demás
      if (isDefault) {
        await prisma.aIProvider.updateMany({
          where: { provider: { not: providerId || '' } },
          data: { isDefault: false },
        });
      }

      const data = {
        provider,
        displayName,
        description,
        isActive: isActive ?? true,
        isDefault: isDefault ?? false,
        apiKeyName,
        configSchema: configSchema || {},
      };

      const existing = await prisma.aIProvider.findUnique({
        where: { id: providerId || '' },
      });

      let result;
      if (existing) {
        result = await prisma.aIProvider.update({
          where: { id: providerId },
          data,
        });

        // Si se deschequea el proveedor, también deschequear todos sus modelos
        if (isActive === false) {
          await prisma.aIModel.updateMany({
            where: { providerId: result.id },
            data: { isActive: false },
          });
        }
      } else {
        result = await prisma.aIProvider.create({
          data,
        });
      }

      res.json({
        success: true,
        provider: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea o actualiza un modelo de IA
   */
  async upsertAIModel(req: Request, res: Response): Promise<void> {
    try {
      const { modelId } = req.params;
      const {
        providerId,
        modelId: modelIdentifier,
        displayName,
        description,
        isActive,
        maxTokens,
        supportsVision,
        supportsTools,
        supportsStreaming,
        costPer1kTokens,
      } = req.body;

      const data = {
        providerId,
        modelId: modelIdentifier,
        displayName,
        description,
        isActive: isActive ?? true,
        maxTokens,
        supportsVision: supportsVision ?? false,
        supportsTools: supportsTools ?? true,
        supportsStreaming: supportsStreaming ?? true,
        costPer1kTokens,
      };

      const existing = await prisma.aIModel.findUnique({
        where: { id: modelId || '' },
      });

      let result;
      if (existing) {
        result = await prisma.aIModel.update({
          where: { id: modelId },
          data,
        });
      } else {
        result = await prisma.aIModel.create({
          data,
        });
      }

      res.json({
        success: true,
        model: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un modelo de IA
   */
  async deleteAIModel(req: Request, res: Response): Promise<void> {
    try {
      const { modelId } = req.params;

      await prisma.aIModel.delete({
        where: { id: modelId },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ==================== PAYMENT PLANS ====================

  /**
   * Lista todos los planes de suscripción
   */
  async listPlans(req: Request, res: Response): Promise<void> {
    try {
      const plans = await prisma.plan.findMany({
        include: {
          _count: {
            select: { tenants: true },
          },
        },
        orderBy: [
          { tier: 'asc' },
          { priceMonthly: 'asc' },
        ],
      });

      res.json({
        plans: plans.map((p) => ({
          id: p.id,
          tier: p.tier,
          name: p.name,
          description: p.description,
          priceMonthly: p.priceMonthly,
          priceYearly: p.priceYearly,
          currency: p.currency,
          isActive: p.isActive,
          features: p.features,
          limits: p.limits,
          tenantsCount: p._count.tenants,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene un plan específico
   */
  async getPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;

      const plan = await prisma.plan.findUnique({
        where: { id: planId },
        include: {
          tenants: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      });

      if (!plan) {
        res.status(404).json({ error: 'Plan no encontrado' });
        return;
      }

      res.json({
        id: plan.id,
        tier: plan.tier,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        currency: plan.currency,
        isActive: plan.isActive,
        features: plan.features,
        limits: plan.limits,
        tenants: plan.tenants,
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Crea o actualiza un plan
   */
  async upsertPlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;
      const {
        tier,
        name,
        description,
        priceMonthly,
        priceYearly,
        currency,
        isActive,
        features,
        limits,
      } = req.body;

      const data = {
        tier,
        name,
        description,
        priceMonthly: priceMonthly ?? 0,
        priceYearly,
        currency: currency || 'USD',
        isActive: isActive ?? true,
        features: features || [],
        limits: limits || {},
      };

      const existing = await prisma.plan.findUnique({
        where: { id: planId || '' },
      });

      let result;
      if (existing) {
        result = await prisma.plan.update({
          where: { id: planId },
          data,
        });
      } else {
        result = await prisma.plan.create({
          data,
        });
      }

      res.json({
        success: true,
        plan: result,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Elimina un plan
   */
  async deletePlan(req: Request, res: Response): Promise<void> {
    try {
      const { planId } = req.params;

      // Verificar que no haya tenants usando el plan
      const tenantsCount = await prisma.tenant.count({
        where: { planId },
      });

      if (tenantsCount > 0) {
        res.status(400).json({
          error: 'No se puede eliminar el plan',
          message: `Hay ${tenantsCount} tenant(s) usando este plan`,
        });
        return;
      }

      await prisma.plan.delete({
        where: { id: planId },
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  // ==================== API KEYS MANAGEMENT ====================

  /**
   * Guarda API keys globales (encriptadas con AES-256-GCM)
   * Valida la API key antes de guardarla
   */
  async saveApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { provider, apiKey, baseUrl } = req.body;

      if (!provider || !apiKey) {
        res.status(400).json({ error: 'Provider y API Key son requeridos' });
        return;
      }

      // Validar la API key antes de guardarla
      const validation = await validateApiKey(provider as any, apiKey);
      if (!validation.valid) {
        res.status(400).json({
          error: 'API key inválida',
          details: validation.error
        });
        return;
      }

      const secureStorage = this.secureStorage;
      await secureStorage.storeApiKey('global', provider, apiKey, baseUrl || '');

      res.json({ success: true, message: `API key de ${provider} guardada correctamente` });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Obtiene el estado de las API keys globales (sin exponer las keys)
   */
  async getApiKeysStatus(req: Request, res: Response): Promise<void> {
    try {
      const secureStorage = this.secureStorage;

      const providers = ['deepseek', 'kimi-coding', 'opencode'];
      const keys: Record<string, boolean> = {};

      for (const provider of providers) {
        const credential = await secureStorage.getApiKey('global', provider as any);
        keys[provider] = !!credential?.apiKey;
      }

      res.json({ keys });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Valida API keys antes de guardarlas (como accomplish)
   */
  async validateApiKeys(req: Request, res: Response): Promise<void> {
    try {
      const { deepseek, kimi, opencode } = req.body;

      const keysToValidate: Partial<Record<'deepseek' | 'kimi' | 'opencode', string>> = {};

      if (deepseek) keysToValidate.deepseek = deepseek;
      if (kimi) keysToValidate.kimi = kimi;
      if (opencode) keysToValidate.opencode = opencode;

      if (Object.keys(keysToValidate).length === 0) {
        res.json({ valid: true, results: {} });
        return;
      }

      const results = await validateApiKeys(keysToValidate);

      const allValid = Object.values(results).every(r => r.valid);

      res.json({
        valid: allValid,
        results,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const adminController = new AdminController();
