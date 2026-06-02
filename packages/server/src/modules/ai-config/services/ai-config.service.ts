/**
 * AI Config Service - Gestión de configuración global de AI y permisos de tenants
 */

import { db } from "@/db"
import { aiGlobalConfig, aiTenantPermissions, aiProviders, aiModels } from "@/db/schema"
import { eq, and } from "drizzle-orm"

class AIConfigService {
  /**
   * Obtiene la configuración global de AI
   */
  async getGlobalConfig() {
    const config = await db.query.aiGlobalConfig.findFirst()
    return config || null
  }

  /**
   * Actualiza la configuración global de AI
   */
  async updateGlobalConfig(data: {
    defaultProvider?: string
    defaultModel?: string
    allowTenantModels?: boolean
  }) {
    // Verificar que el provider existe
    if (data.defaultProvider) {
      const provider = await db.query.aiProviders.findFirst({
        where: eq(aiProviders.provider, data.defaultProvider)
      })
      if (!provider) {
        throw new Error(`Provider "${data.defaultProvider}" not found`)
      }
    }

    // Obtener config actual o crear nueva
    const current = await this.getGlobalConfig()

    if (current) {
      const [updated] = await db
        .update(aiGlobalConfig)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(aiGlobalConfig.id, current.id))
        .returning()

      return updated
    } else {
      const [created] = await db
        .insert(aiGlobalConfig)
        .set({
          defaultProvider: data.defaultProvider || "opencode",
          defaultModel: data.defaultModel || "gpt-4o-mini",
          allowTenantModels: data.allowTenantModels ?? false,
        })
        .returning()

      return created
    }
  }

  /**
   * Obtiene los permisos de un tenant
   */
  async getTenantPermissions(tenantId: string) {
    const permissions = await db.query.aiTenantPermissions.findFirst({
      where: eq(aiTenantPermissions.tenantId, tenantId)
    })
    return permissions
  }

  /**
   * Actualiza los permisos de un tenant (solo admin)
   */
  async updateTenantPermissions(tenantId: string, data: {
    canUseOwnModel?: boolean
    ownProvider?: string
    ownModel?: string
  }) {
    const current = await this.getTenantPermissions(tenantId)

    // Si se está configurando modelo propio, verificar que el provider existe
    if (data.ownProvider) {
      const provider = await db.query.aiProviders.findFirst({
        where: eq(aiProviders.provider, data.ownProvider)
      })
      if (!provider) {
        throw new Error(`Provider "${data.ownProvider}" not found`)
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.canUseOwnModel !== undefined) {
      updateData.canUseOwnModel = data.canUseOwnModel
    }

    if (data.ownProvider !== undefined) {
      updateData.ownProvider = data.ownProvider
      updateData.hasOwnModel = !!(data.ownProvider && data.ownModel)
    }

    if (data.ownModel !== undefined) {
      updateData.ownModel = data.ownModel
      updateData.hasOwnModel = !!(data.ownProvider && data.ownModel)
    }

    if (current) {
      const [updated] = await db
        .update(aiTenantPermissions)
        .set(updateData)
        .where(eq(aiTenantPermissions.id, current.id))
        .returning()

      return updated
    } else {
      const [created] = await db
        .insert(aiTenantPermissions)
        .set({
          tenantId,
          canUseOwnModel: data.canUseOwnModel ?? false,
          ownProvider: data.ownProvider || null,
          ownModel: data.ownModel || null,
          hasOwnModel: !!(data.ownProvider && data.ownModel),
        })
        .returning()

      return created
    }
  }

  /**
   * Verifica si un tenant puede usar su propio modelo
   */
  async canTenantUseOwnModel(tenantId: string): Promise<boolean> {
    const permissions = await this.getTenantPermissions(tenantId)
    return permissions?.canUseOwnModel || false
  }

  /**
   * Obtiene el modelo que debe usar un tenant
   * - Si tiene autorización y modelo propio → usa ese
   * - Si no → usa el default global
   */
  async getModelForTenant(tenantId: string): Promise<{
    provider: string
    model: string
    source: "tenant" | "global"
  }> {
    const permissions = await this.getTenantPermissions(tenantId)
    const globalConfig = await this.getGlobalConfig()

    // Verificar si el tenant tiene autorización y modelo propio configurado
    if (permissions?.canUseOwnModel && permissions?.ownProvider && permissions?.ownModel) {
      return {
        provider: permissions.ownProvider,
        model: permissions.ownModel,
        source: "tenant"
      }
    }

    // Usar configuración global
    if (!globalConfig) {
      throw new Error("No global AI configuration found")
    }

    return {
      provider: globalConfig.defaultProvider,
      model: globalConfig.defaultModel,
      source: "global"
    }
  }

  /**
   * Lista todos los tenants con sus permisos
   */
  async listAllTenantsPermissions() {
    const permissions = await db.query.aiTenantPermissions.findMany()

    // Obtener info de tenants
    const { tenants } = await import("@/db/schema")
    const tenantsList = await db.query.tenants.findMany()

    return tenantsList.map(tenant => {
      const perm = permissions.find(p => p.tenantId === tenant.id)
      return {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        canUseOwnModel: perm?.canUseOwnModel || false,
        hasOwnModel: perm?.hasOwnModel || false,
        ownProvider: perm?.ownProvider || null,
        ownModel: perm?.ownModel || null,
      }
    })
  }
}

export const aiConfigService = new AIConfigService()
