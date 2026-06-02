/**
 * Integrations Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import {
  integrationsService,
  type CreateIntegrationInput,
  type UpdateIntegrationInput,
} from "../services/integrations.service"

export class IntegrationsController {
  /**
   * POST /api/v1/integrations
   * Crea una nueva integracion
   */
  async create(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()

    // Validar campos requeridos
    if (!body.name) {
      throw new HTTPException(400, { message: "El nombre es requerido" })
    }
    if (!body.type) {
      throw new HTTPException(400, { message: "El tipo es requerido" })
    }
    if (!body.credentials) {
      throw new HTTPException(400, { message: "Las credenciales son requeridas" })
    }

    const integration = await integrationsService.create({
      tenantId,
      name: body.name,
      type: body.type,
      credentials: body.credentials,
      baseUrl: body.baseUrl,
      webhookUrl: body.webhookUrl,
    })

    return c.json({
      success: true,
      data: integration,
    })
  }

  /**
   * GET /api/v1/integrations
   * Lista integraciones con filtros
   */
  async list(c: Context) {
    const tenantId = c.get("tenantId") as string
    const type = c.req.query("type") as string | undefined
    const status = c.req.query("status") as string | undefined
    const search = c.req.query("search")
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")

    const result = await integrationsService.list({
      tenantId,
      type: type as any,
      status: status as any,
      search,
      page,
      limit,
    })

    return c.json({
      success: true,
      data: result.integrations,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    })
  }

  /**
   * GET /api/v1/integrations/:id
   * Obtiene una integracion por ID
   */
  async getById(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const integration = await integrationsService.getById(id, tenantId)

    if (!integration) {
      throw new HTTPException(404, { message: "Integracion no encontrada" })
    }

    return c.json({
      success: true,
      data: integration,
    })
  }

  /**
   * PUT /api/v1/integrations/:id
   * Actualiza una integracion
   */
  async update(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    const integration = await integrationsService.update(id, tenantId, body)

    return c.json({
      success: true,
      data: integration,
    })
  }

  /**
   * DELETE /api/v1/integrations/:id
   * Elimina una integracion
   */
  async delete(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    await integrationsService.delete(id, tenantId)

    return c.json({
      success: true,
      message: "Integracion eliminada correctamente",
    })
  }

  /**
   * PATCH /api/v1/integrations/:id/activate
   * Activa una integracion
   */
  async activate(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const integration = await integrationsService.activate(id, tenantId)

    return c.json({
      success: true,
      data: integration,
      message: "Integracion activada correctamente",
    })
  }

  /**
   * PATCH /api/v1/integrations/:id/deactivate
   * Desactiva una integracion
   */
  async deactivate(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const integration = await integrationsService.deactivate(id, tenantId)

    return c.json({
      success: true,
      data: integration,
      message: "Integracion desactivada correctamente",
    })
  }

  /**
   * POST /api/v1/integrations/:id/test
   * Prueba la conexion de una integracion
   */
  async testConnection(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const result = await integrationsService.testConnection(id, tenantId)

    return c.json({
      success: true,
      data: result,
    })
  }

  /**
   * GET /api/v1/integrations/type/:type
   * Obtiene integraciones por tipo
   */
  async getByType(c: Context) {
    const tenantId = c.get("tenantId") as string
    const type = c.req.param("type") as string

    const integrations = await integrationsService.getByType(tenantId, type as any)

    return c.json({
      success: true,
      data: integrations,
    })
  }

  /**
   * GET /api/v1/integrations/active
   * Obtiene integraciones activas
   */
  async getActive(c: Context) {
    const tenantId = c.get("tenantId") as string

    const integrations = await integrationsService.getActiveIntegrations(tenantId)

    return c.json({
      success: true,
      data: integrations,
    })
  }

  /**
   * GET /api/v1/integrations/stats
   * Obtiene estadisticas de integraciones
   */
  async getStats(c: Context) {
    const tenantId = c.get("tenantId") as string

    const stats = await integrationsService.getStats(tenantId)

    return c.json({
      success: true,
      data: stats,
    })
  }

  /**
   * POST /api/v1/integrations/:id/agents/:agentId
   * Asocia una integracion a un agente
   */
  async assignToAgent(c: Context) {
    const tenantId = c.get("tenantId") as string
    const integrationId = c.req.param("id")
    const agentId = c.req.param("agentId")
    const body = await c.req.json().catch(() => ({}))

    const result = await integrationsService.assignToAgent(
      integrationId,
      agentId,
      tenantId,
      body.config
    )

    return c.json({
      success: true,
      data: result,
      message: "Integracion asociada al agente correctamente",
    })
  }

  /**
   * DELETE /api/v1/integrations/:id/agents/:agentId
   * Desasocia una integracion de un agente
   */
  async unassignFromAgent(c: Context) {
    const tenantId = c.get("tenantId") as string
    const integrationId = c.req.param("id")
    const agentId = c.req.param("agentId")

    await integrationsService.unassignFromAgent(integrationId, agentId, tenantId)

    return c.json({
      success: true,
      message: "Integracion desasociada del agente correctamente",
    })
  }
}

export const integrationsController = new IntegrationsController()
