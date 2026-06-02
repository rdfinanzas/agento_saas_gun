/**
 * AI Config Controller - Endpoints para configuración de AI del admin
 */

import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { aiConfigService } from '../services/ai-config.service'

export class AIConfigController {
  /**
   * GET /api/v1/admin/ai-config/global
   * Obtiene la configuración global de AI
   */
  async getGlobalConfig(c: Context) {
    const config = await aiConfigService.getGlobalConfig()

    if (!config) {
      throw new HTTPException(404, { message: 'Global AI config not found' })
    }

    return c.json({ success: true, data: config })
  }

  /**
   * PUT /api/v1/admin/ai-config/global
   * Actualiza la configuración global de AI
   */
  async updateGlobalConfig(c: Context) {
    const body = await c.req.json()
    const { defaultProvider, defaultModel, allowTenantModels } = body

    const config = await aiConfigService.updateGlobalConfig({
      defaultProvider,
      defaultModel,
      allowTenantModels,
    })

    return c.json({ success: true, data: config })
  }

  /**
   * GET /api/v1/admin/ai-config/tenants
   * Lista todos los tenants con sus permisos de AI
   */
  async listTenantsPermissions(c: Context) {
    const tenants = await aiConfigService.listAllTenantsPermissions()
    return c.json({ success: true, data: tenants })
  }

  /**
   * GET /api/v1/admin/ai-config/tenants/:tenantId
   * Obtiene los permisos de un tenant específico
   */
  async getTenantPermissions(c: Context) {
    const { tenantId } = c.req.param()
    const permissions = await aiConfigService.getTenantPermissions(tenantId)

    if (!permissions) {
      return c.json({
        success: true,
        data: {
          tenantId,
          canUseOwnModel: false,
          hasOwnModel: false,
          ownProvider: null,
          ownModel: null,
        }
      })
    }

    return c.json({ success: true, data: permissions })
  }

  /**
   * PUT /api/v1/admin/ai-config/tenants/:tenantId
   * Actualiza los permisos de un tenant (autorizar/desautorizar)
   */
  async updateTenantPermissions(c: Context) {
    const { tenantId } = c.req.param()
    const body = await c.req.json()
    const { canUseOwnModel, ownProvider, ownModel } = body

    const permissions = await aiConfigService.updateTenantPermissions(tenantId, {
      canUseOwnModel,
      ownProvider,
      ownModel,
    })

    return c.json({ success: true, data: permissions })
  }

  /**
   * GET /api/v1/admin/ai-config/check/:tenantId
   * Verifica si un tenant puede usar su propio modelo
   * Usado por el frontend para mostrar/ocultar la sección de configuración
   */
  async checkTenantPermission(c: Context) {
    const { tenantId } = c.req.param()

    const canUse = await aiConfigService.canTenantUseOwnModel(tenantId)
    const permissions = await aiConfigService.getTenantPermissions(tenantId)
    const globalConfig = await aiConfigService.getGlobalConfig()

    return c.json({
      success: true,
      data: {
        canUseOwnModel: canUse,
        hasOwnModel: permissions?.hasOwnModel || false,
        ownProvider: permissions?.ownProvider || null,
        ownModel: permissions?.ownModel || null,
        globalDefault: globalConfig ? {
          provider: globalConfig.defaultProvider,
          model: globalConfig.defaultModel,
        } : null,
      }
    })
  }

  /**
   * GET /api/v1/admin/ai-config/model-for-tenant/:tenantId
   * Obtiene el modelo que debe usar un tenant (propio o global)
   */
  async getModelForTenant(c: Context) {
    const { tenantId } = c.req.param()

    const model = await aiConfigService.getModelForTenant(tenantId)

    return c.json({
      success: true,
      data: model
    })
  }
}

export const aiConfigController = new AIConfigController()
