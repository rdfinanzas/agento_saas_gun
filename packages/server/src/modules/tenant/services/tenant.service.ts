/**
 * Tenant Service - Migrado a Drizzle
 */

import { eq, and, desc, like, or, sql } from "drizzle-orm"
import { db } from "../../../db"
import { tenants, users, subscriptions } from "../../../db/schema"

export interface CreateTenantInput {
  name: string
  slug: string
  email?: string
  subscriptionTier?: string
}

export interface UpdateTenantInput {
  name?: string
  slug?: string
  email?: string
  status?: string
  subscriptionTier?: string
}

export interface TenantFilterOptions {
  search?: string
  status?: string
  page?: number
  limit?: number
}

class TenantService {
  /**
   * Crea un nuevo tenant
   */
  async create(data: CreateTenantInput) {
    // Verificar que el slug no existe
    const existing = await db.query.tenants.findFirst({
      where: eq(tenants.slug, data.slug),
    })

    if (existing) {
      throw new Error("Tenant slug already exists")
    }

    const [tenant] = await db
      .insert(tenants)
      .values({
        name: data.name,
        slug: data.slug,
        email: data.email,
        subscriptionTier: data.subscriptionTier || "FREE",
        status: "TRIAL",
      })
      .returning()

    return tenant
  }

  /**
   * Obtiene un tenant por ID
   */
  async getById(id: string) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, id),
      with: {
        users: true,
        subscription: true,
      },
    })

    return tenant || null
  }

  /**
   * Obtiene un tenant por slug
   */
  async getBySlug(slug: string) {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.slug, slug),
      with: {
        users: true,
        subscription: true,
      },
    })

    return tenant || null
  }

  /**
   * Lista tenants con filtros y paginación
   */
  async list(options: TenantFilterOptions = {}) {
    const { search, status, page = 1, limit = 20 } = options
    const skip = (page - 1) * limit

    // Build where conditions
    const conditions = []

    if (status) {
      conditions.push(eq(tenants.status, status))
    }

    const allTenants = await db.query.tenants.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      with: {
        users: {
          limit: 5,
        },
        subscription: true,
      },
      orderBy: [desc(tenants.createdAt)],
    })

    // Filter by search if provided
    let filtered = allTenants
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = allTenants.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.slug.toLowerCase().includes(searchLower) ||
          t.email?.toLowerCase().includes(searchLower)
      )
    }

    // Get total count
    const total = filtered.length

    // Paginate
    const paginated = filtered.slice(skip, skip + limit)

    return {
      tenants: paginated,
      total,
      page,
      limit,
    }
  }

  /**
   * Actualiza un tenant
   */
  async update(id: string, data: UpdateTenantInput) {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error("Tenant not found")
    }

    // Verificar slug único si se está cambiando
    if (data.slug && data.slug !== existing.slug) {
      const slugExists = await db.query.tenants.findFirst({
        where: eq(tenants.slug, data.slug),
      })

      if (slugExists) {
        throw new Error("Tenant slug already exists")
      }
    }

    const [updated] = await db
      .update(tenants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))
      .returning()

    return updated
  }

  /**
   * Elimina un tenant (soft delete)
   */
  async delete(id: string) {
    const existing = await this.getById(id)

    if (!existing) {
      throw new Error("Tenant not found")
    }

    const [deleted] = await db
      .update(tenants)
      .set({ status: "DELETED", updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning()

    return deleted
  }

  /**
   * Obtiene estadísticas del tenant
   */
  async getStats(id: string) {
    const tenant = await this.getById(id)

    if (!tenant) {
      throw new Error("Tenant not found")
    }

    // Get counts
    const [usersList, agentsList, conversationsList] = await Promise.all([
      db.query.users.findMany({ where: eq(users.tenantId, id) }),
      // Note: agents table might be in a different schema
      Promise.resolve([]),
      Promise.resolve([]),
    ])

    return {
      users: usersList.length,
      agents: 0, // TODO: implement when agents table is available
      conversations: 0, // TODO: implement when conversations table is available
      subscription: tenant.subscription,
    }
  }

  /**
   * Cambia el plan de suscripción
   */
  async changePlan(id: string, tier: string) {
    const validTiers = ["FREE", "PRO", "ENTERPRISE"]

    if (!validTiers.includes(tier)) {
      throw new Error("Invalid subscription tier")
    }

    return this.update(id, { subscriptionTier: tier })
  }

  /**
   * Activa un tenant
   */
  async activate(id: string) {
    return this.update(id, { status: "ACTIVE" })
  }

  /**
   * Suspende un tenant
   */
  async suspend(id: string) {
    return this.update(id, { status: "SUSPENDED" })
  }
}

export const tenantService = new TenantService()
