/**
 * API Keys Controller
 * Maneja el almacenamiento seguro de API keys para proveedores de IA
 */

import { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { getSecureStorage } from '../../../lib/secure-storage/SecureStorage'

export class ApiKeysController {
  /**
   * POST /api/v1/admin/api-keys
   * Guarda una API key para un proveedor
   *
   * NOTA: Los admins globales guardan las API keys como "default" (global)
   * que pueden ser usadas por todos los tenants.
   */
  async storeApiKey(c: Context) {
    const body = await c.req.json()
    const { provider, apiKey, tenantId } = body

    if (!provider || !apiKey) {
      throw new HTTPException(400, { message: 'Provider and apiKey are required' })
    }

    // Verificar si el usuario es admin global
    const userRole = c.get('userRole')
    const isAdmin = userRole === 'admin' || userRole === 'super_admin'

    // Determinar el tenant objetivo:
    // - Si es admin global y no se especifica tenantId, usar "default" (global)
    // - Si se especifica tenantId explícitamente, usar ese
    // - Si no es admin, usar el tenant del usuario
    let targetTenantId: string

    if (tenantId) {
      // Se especificó un tenant explícitamente
      targetTenantId = tenantId
    } else if (isAdmin) {
      // Admin global: guardar como "default" para uso global
      targetTenantId = "default"
      console.log("[ApiKeysController] Admin global storing API key as 'default' for provider", provider)
    } else {
      // Usuario normal: usar su tenant
      targetTenantId = c.get('tenantId') || ""
    }

    if (!targetTenantId) {
      throw new HTTPException(400, { message: 'Tenant ID is required' })
    }

    const secureStorage = getSecureStorage()
    await secureStorage.storeApiKey(targetTenantId, provider, apiKey)

    console.log("[ApiKeysController] API key stored", {
      provider,
      tenantId: targetTenantId,
      isGlobal: targetTenantId === "default"
    })

    return c.json({
      success: true,
      message: `API key stored successfully${targetTenantId === 'default' ? ' as global default' : ''}`,
    })
  }

  /**
   * GET /api/v1/admin/api-keys/:provider
   * Verifica si un proveedor tiene API key configurada
   * Verifica primero a nivel tenant, luego a nivel global
   */
  async hasApiKey(c: Context) {
    const provider = c.req.param('provider')
    const tenantId = c.req.query('tenantId') || c.get('tenantId')

    if (!provider) {
      throw new HTTPException(400, { message: 'Provider is required' })
    }

    if (!tenantId) {
      throw new HTTPException(400, { message: 'Tenant ID is required' })
    }

    const secureStorage = getSecureStorage()

    // Verificar primero a nivel tenant
    let hasKey = await secureStorage.hasApiKey(tenantId, provider)

    // Si no tiene, verificar a nivel global (default)
    if (!hasKey) {
      hasKey = await secureStorage.hasApiKey('default', provider)
      console.log(`[ApiKeysController] Provider ${provider}: tenant key=${await secureStorage.hasApiKey(tenantId, provider)}, global key=${hasKey}`)
    }

    return c.json({
      success: true,
      hasApiKey: hasKey,
      source: hasKey && await secureStorage.hasApiKey(tenantId, provider) ? 'tenant' : 'global',
    })
  }

  /**
   * DELETE /api/v1/admin/api-keys/:provider
   * Elimina una API key almacenada
   */
  async deleteApiKey(c: Context) {
    const provider = c.req.param('provider')
    const tenantId = c.req.query('tenantId') || c.get('tenantId')

    if (!provider) {
      throw new HTTPException(400, { message: 'Provider is required' })
    }

    if (!tenantId) {
      throw new HTTPException(400, { message: 'Tenant ID is required' })
    }

    const secureStorage = getSecureStorage()
    await secureStorage.deleteApiKey(tenantId, provider)

    return c.json({
      success: true,
      message: 'API key deleted successfully',
    })
  }

  /**
   * GET /api/v1/admin/api-keys
   * Lista todos los proveedores con API keys configuradas
   */
  async listApiKeys(c: Context) {
    const tenantId = c.req.query('tenantId') || c.get('tenantId')

    if (!tenantId) {
      throw new HTTPException(400, { message: 'Tenant ID is required' })
    }

    const secureStorage = getSecureStorage()
    const providers = await secureStorage.listProviders(tenantId)

    return c.json({
      success: true,
      providers,
    })
  }
}

export const apiKeysController = new ApiKeysController()
