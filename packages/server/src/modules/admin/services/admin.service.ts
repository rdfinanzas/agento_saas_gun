/**
 * Admin Service - Migrado a Drizzle
 */

import { eq, and, desc, sql, ne } from "drizzle-orm"
import { db } from "../../../db"
import { tenants, users, tenantUsers, plans, aiProviders, aiModels, subscriptions, payments } from "../../../db/schema"

class AdminService {
  /**
   * Obtiene estadísticas globales del sistema
   */
  async getStats() {
    const [
      totalTenants,
      totalTenantUsers,
      activeSubscriptions,
      totalPayments,
      aiProvidersCount,
    ] = await Promise.all([
      db.query.tenants.findMany(),
      db.query.tenantUsers.findMany(),
      db.query.subscriptions.findMany({ where: eq(subscriptions.status, "ACTIVE") }),
      db.query.payments.findMany(),
      db.query.aiProviders.findMany({ where: eq(aiProviders.isActive, true) }),
    ])

    return {
      tenants: totalTenants.length,
      users: totalTenantUsers.length,
      activeSubscriptions: activeSubscriptions.length,
      totalPayments: totalPayments.length,
      aiProviders: aiProvidersCount.length,
    }
  }

  /**
   * Lista todos los tenants con paginación
   */
  async listTenants(options?: { page?: number; limit?: number; search?: string }) {
    const page = options?.page || 1
    const limit = options?.limit || 20
    const skip = (page - 1) * limit

    const allTenants = await db.query.tenants.findMany({
      with: {
        users: {
          with: {
            user: true,
          },
        },
        subscription: true,
      },
      orderBy: [desc(tenants.createdAt)],
    })

    let filtered = allTenants
    if (options?.search) {
      const search = options.search.toLowerCase()
      filtered = allTenants.filter(
        (t) =>
          t.name.toLowerCase().includes(search) ||
          t.slug?.toLowerCase().includes(search)
      )
    }

    // Calculate additional fields for each tenant
    const tenantsWithCounts = filtered.map((tenant) => ({
      ...tenant,
      usersCount: tenant.users.length,
      conversationsCount: 0, // TODO: Add when conversations are implemented
      agentsCount: 0, // TODO: Add when agents are properly linked
      subscriptionStatus: tenant.subscription?.status || null,
    }))

    const paginated = tenantsWithCounts.slice(skip, skip + limit)

    return {
      tenants: paginated,
      total: tenantsWithCounts.length,
      page,
      limit,
      pagination: {
        page,
        limit,
        total: tenantsWithCounts.length,
        pages: Math.ceil(tenantsWithCounts.length / limit),
      },
    }
  }

  /**
   * Obtiene un tenant por ID
   */
  async getTenantById(id: string) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id),
      with: {
        users: {
          with: {
            user: true,
          },
        },
        subscription: true,
      },
    })

    return tenant || null
  }

  /**
   * Actualiza un tenant
   */
  async updateTenant(id: string, data: { name?: string; status?: string; subscriptionTier?: string }) {
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.status !== undefined) updateData.status = data.status
    if (data.subscriptionTier !== undefined) updateData.subscriptionTier = data.subscriptionTier

    const [updated] = await db
      .update(tenants)
      .set(updateData)
      .where(eq(tenants.id, id))
      .returning()

    return updated
  }

  /**
   * Lista todos los usuarios con paginación
   */
  async listUsers(options?: { page?: number; limit?: number; search?: string; tenantId?: string }) {
    const page = options?.page || 1
    const limit = options?.limit || 20
    const skip = (page - 1) * limit

    // Get all tenant users with their user and tenant info
    let allTenantUsers = await db.query.tenantUsers.findMany({
      with: {
        user: true,
        tenant: true,
      },
      orderBy: [desc(tenantUsers.createdAt)],
    })

    // Filter by tenant if specified
    if (options?.tenantId) {
      allTenantUsers = allTenantUsers.filter((tu) => tu.tenantId === options.tenantId)
    }

    // Apply search filter
    let filtered = allTenantUsers
    if (options?.search) {
      const search = options.search.toLowerCase()
      filtered = allTenantUsers.filter(
        (tu) =>
          tu.user.name.toLowerCase().includes(search) ||
          tu.user.email.toLowerCase().includes(search)
      )
    }

    // Group by user to build tenants array
    const userMap = new Map<string, {
      id: string
      email: string
      name: string
      createdAt: string
      tenants: { id: string; name: string; role: string }[]
    }>()

    for (const tu of filtered) {
      const userId = tu.user.id
      if (!userMap.has(userId)) {
        userMap.set(userId, {
          id: tu.user.id,
          email: tu.user.email,
          name: tu.user.name,
          createdAt: tu.user.createdAt,
          tenants: [],
        })
      }
      userMap.get(userId)!.tenants.push({
        id: tu.tenant.id,
        name: tu.tenant.name,
        role: tu.role,
      })
    }

    const allUsers = Array.from(userMap.values())

    // Paginate users
    const users = allUsers.slice(skip, skip + limit)

    return {
      users,
      total: allUsers.length,
      page,
      limit,
    }
  }

  /**
   * Lista todos los planes
   */
  async listPlans() {
    return db.query.plans.findMany({
      orderBy: [desc(plans.createdAt)],
    })
  }

  /**
   * Obtiene un plan por ID
   */
  async getPlanById(id: string) {
    const plan = await db.query.plans.findFirst({
      where: eq(plans.id, id),
    })

    return plan || null
  }

  /**
   * Crea o actualiza un plan
   */
  async upsertPlan(id: string | undefined, data: {
    tier: string
    name: string
    description?: string
    priceMonthly?: number
    priceYearly?: number
    limits?: Record<string, unknown>
    features?: Record<string, unknown>
    isActive?: boolean
    createdAt?: string
    updatedAt?: string
  }) {
    if (id) {
      // Only update specific fields, not timestamps
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (data.tier !== undefined) updateData.tier = data.tier
      if (data.name !== undefined) updateData.name = data.name
      if (data.description !== undefined) updateData.description = data.description
      if (data.priceMonthly !== undefined) updateData.priceMonthly = data.priceMonthly
      if (data.priceYearly !== undefined) updateData.priceYearly = data.priceYearly
      if (data.limits !== undefined) updateData.limits = data.limits
      if (data.features !== undefined) updateData.features = data.features
      if (data.isActive !== undefined) updateData.isActive = data.isActive ? 'true' : 'false'

      const [updated] = await db
        .update(plans)
        .set(updateData)
        .where(eq(plans.id, id))
        .returning()

      return updated
    } else {
      const [created] = await db.insert(plans).values(data).returning()
      return created
    }
  }

  /**
   * Elimina un plan
   */
  async deletePlan(id: string) {
    const [deleted] = await db.delete(plans).where(eq(plans.id, id)).returning()
    return deleted
  }

  /**
   * Lista todos los proveedores de IA
   */
  async listAIProviders(tenantId?: string) {
    const providers = await db.query.aiProviders.findMany({
      with: {
        models: true,
      },
      orderBy: [desc(aiProviders.createdAt)],
    })

    // Get SecureStorage to check API keys
    const { getSecureStorage } = await import('../../../lib/secure-storage/SecureStorage')
    const secureStorage = getSecureStorage()

    // Add hasApiKey flag to each provider
    // Check both tenant-specific and global (default) API keys
    const providersWithStatus = await Promise.all(
      providers.map(async (provider) => {
        // Primero verificar si el tenant tiene su propia API key
        const hasTenantKey = tenantId ? await secureStorage.hasApiKey(tenantId, provider.provider) : false

        // Si no tiene, verificar si existe API key global
        const hasGlobalKey = await secureStorage.hasApiKey('default', provider.provider)

        const hasKey = hasTenantKey || hasGlobalKey

        console.log(`[DEBUG] Provider ${provider.provider} hasApiKey:`, {
          hasTenantKey,
          hasGlobalKey,
          hasKey,
          tenantId,
        })

        return {
          ...provider,
          hasApiKey: hasKey,
        }
      })
    )

    return providersWithStatus
  }

  /**
   * Obtiene un proveedor de IA por ID
   */
  async getAIProviderById(id: string) {
    const provider = await db.query.aiProviders.findFirst({
      where: eq(aiProviders.id, id),
      with: {
        models: true,
      },
    })

    return provider || null
  }

  /**
   * Lista proveedores públicos activos con API key configurada
   * Para uso en workspace de usuarios regulares
   *
   * Lógica:
   * 1. Si el tenant tiene su propia API key configurada → usar esa
   * 2. Si no, pero el sistema tiene API key → usar la del sistema
   * 3. Solo mostrar proveedores que tengan API key (del tenant o del sistema)
   */
  async listPublicAIProviders(tenantId: string) {
    // Obtener solo proveedores activos desde DB
    const providers = await db.query.aiProviders.findMany({
      where: eq(aiProviders.isActive, true),
      with: {
        models: true,
      },
      orderBy: [desc(aiProviders.createdAt)],
    })

    const { getSecureStorage } = await import('../../../lib/secure-storage/SecureStorage')
    const secureStorage = getSecureStorage()

    // Tenant ID del sistema (super admin) - buscar tenant con slug "agento-superadmin"
    const systemTenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, "agento-superadmin"),
    })
    const systemTenantId = systemTenant?.id

    const providersWithKey = await Promise.all(
      providers.map(async (provider) => {
        // Verificar si el tenant tiene su propia API key
        const hasTenantKey = await secureStorage.hasApiKey(tenantId, provider.provider)

        // Verificar si el sistema tiene API key
        let hasSystemKey = false
        if (systemTenantId) {
          hasSystemKey = await secureStorage.hasApiKey(systemTenantId, provider.provider)
        }

        // Mostrar proveedor si tiene API key del tenant O del sistema
        if (hasTenantKey || hasSystemKey) {
          return {
            ...provider,
            models: provider.models.filter(m => m.isActive === true),
            // Indicar si usa API key del tenant o del sistema
            usesSystemKey: !hasTenantKey && hasSystemKey,
          }
        }
        return null
      })
    )

    // Filtrar nulls y devolver
    return providersWithKey.filter(p => p !== null)
  }

  /**
   * Crea o actualiza un proveedor de IA
   */
  async upsertAIProvider(id: string | undefined, data: {
    provider: string
    displayName: string
    description?: string
    baseUrl?: string
    apiKeyName?: string
    configSchema?: Record<string, unknown>
    isActive?: boolean
    isDefault?: boolean
    createdAt?: string
    updatedAt?: string
    models?: unknown[]
  }, tenantId?: string) {
    console.log('[DEBUG] upsertAIProvider called with id:', id, 'data:', JSON.stringify(data, null, 2))

    if (id) {
      // Validación: No se puede activar un proveedor sin API key
      if (data.isActive === true && tenantId) {
        const { getSecureStorage } = await import('../../../lib/secure-storage/SecureStorage')
        const secureStorage = getSecureStorage()
        const provider = await db.query.aiProviders.findFirst({
          where: eq(aiProviders.id, id),
        })
        if (provider) {
          const hasApiKey = await secureStorage.hasApiKey(tenantId, provider.provider)
          if (!hasApiKey) {
            console.log('[DEBUG] Cannot activate provider without API key, throwing error')
            throw new Error(
              `No se puede activar el proveedor "${provider.displayName}" sin una API key configurada. ` +
              `Por favor, configura la API key primero y luego intenta activar el proveedor.`
            )
          }
        }
      }

      // Only update specific fields, not timestamps or nested objects
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (data.provider !== undefined) updateData.provider = data.provider
      if (data.displayName !== undefined) updateData.displayName = data.displayName
      if (data.description !== undefined) updateData.description = data.description
      if (data.apiKeyName !== undefined) updateData.apiKeyName = data.apiKeyName
      if (data.configSchema !== undefined) updateData.configSchema = data.configSchema
      if (data.isActive !== undefined) updateData.isActive = data.isActive
      if (data.isDefault !== undefined) updateData.isDefault = data.isDefault

      console.log('[DEBUG] updateData:', JSON.stringify(updateData, null, 2))

      const [updated] = await db
        .update(aiProviders)
        .set(updateData)
        .where(eq(aiProviders.id, id))
        .returning()

      console.log('[DEBUG] Updated provider:', JSON.stringify(updated, null, 2))

      // Si se marca como default, desmarcar todos los demás proveedores
      if (data.isDefault === true) {
        await db
          .update(aiProviders)
          .set({ isDefault: false, updatedAt: new Date() })
          .where(ne(aiProviders.id, id)) // Todos los proveedores EXCEPTO el actual
        console.log('[DEBUG] Unmarked other providers as default')
      }

      // Si se desactiva el proveedor, también desactivar todos sus modelos
      if (data.isActive === false) {
        await db
          .update(aiModels)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(aiModels.providerId, id))
        console.log('[DEBUG] Deactivated all models for provider:', id)
      }

      return updated
    } else {
      const [created] = await db.insert(aiProviders).values(data).returning()
      return created
    }
  }

  /**
   * Lista todos los modelos de IA
   */
  async listAIModels(providerId?: string) {
    const conditions = providerId ? [eq(aiModels.providerId, providerId)] : []

    return db.query.aiModels.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        provider: true,
      },
      orderBy: [desc(aiModels.createdAt)],
    })
  }

  /**
   * Crea o actualiza un modelo de IA
   */
  async upsertAIModel(id: string | undefined, data: {
    providerId: string
    modelId: string
    displayName: string
    description?: string
    isActive?: boolean
    maxTokens?: number
    supportsVision?: boolean
    supportsTools?: boolean
    supportsStreaming?: boolean
    costPer1kTokens?: number
    createdAt?: string
    updatedAt?: string
    provider?: unknown
  }) {
    if (id) {
      // Only update specific fields, not timestamps or nested objects
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (data.providerId !== undefined) updateData.providerId = data.providerId
      if (data.modelId !== undefined) updateData.modelId = data.modelId
      if (data.displayName !== undefined) updateData.displayName = data.displayName
      if (data.description !== undefined) updateData.description = data.description
      if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens.toString()
      if (data.supportsVision !== undefined) updateData.supportsVision = data.supportsVision ? 'true' : 'false'
      if (data.supportsTools !== undefined) updateData.supportsTools = data.supportsTools ? 'true' : 'false'
      if (data.supportsStreaming !== undefined) updateData.supportsStreaming = data.supportsStreaming ? 'true' : 'false'
      if (data.costPer1kTokens !== undefined) updateData.costPer1kTokens = data.costPer1kTokens.toString()
      if (data.isActive !== undefined) updateData.isActive = data.isActive ? 'true' : 'false'

      const [updated] = await db
        .update(aiModels)
        .set(updateData)
        .where(eq(aiModels.id, id))
        .returning()

      return updated
    } else {
      const [created] = await db.insert(aiModels).values(data).returning()
      return created
    }
  }

  /**
   * Elimina un modelo de IA
   */
  async deleteAIModel(id: string) {
    const [deleted] = await db.delete(aiModels).where(eq(aiModels.id, id)).returning()
    return deleted
  }
}

export const adminService = new AdminService()
