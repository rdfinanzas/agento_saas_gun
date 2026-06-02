/**
 * WhatsApp Config Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import {
  whatsappConfigService,
  type CreateWhatsAppConfigInput,
  type UpdateWhatsAppConfigInput,
} from "../services/whatsapp-config.service"

export class WhatsAppConfigController {
  /**
   * POST /api/v1/whatsapp
   * Crea una nueva configuración de WhatsApp
   */
  async create(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()

    const config = await whatsappConfigService.create({
      tenantId,
      ...body,
    })

    return c.json({
      success: true,
      data: config,
    })
  }

  /**
   * GET /api/v1/whatsapp
   * Lista todas las configuraciones de WhatsApp del tenant
   */
  async list(c: Context) {
    const tenantId = c.get("tenantId") as string
    const includeInactive = c.req.query("includeInactive") === "true"

    const configs = await whatsappConfigService.list(tenantId, includeInactive)

    return c.json({
      success: true,
      data: configs,
    })
  }

  /**
   * GET /api/v1/whatsapp/:id
   * Obtiene una configuración por ID
   */
  async getById(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const config = await whatsappConfigService.getById(id, tenantId)

    if (!config) {
      throw new HTTPException(404, { message: "WhatsApp config not found" })
    }

    return c.json({
      success: true,
      data: config,
    })
  }

  /**
   * PUT /api/v1/whatsapp/:id
   * Actualiza una configuración
   */
  async update(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    const config = await whatsappConfigService.update(id, tenantId, body)

    return c.json({
      success: true,
      data: config,
    })
  }

  /**
   * DELETE /api/v1/whatsapp/:id
   * Elimina una configuración (soft delete)
   */
  async delete(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    await whatsappConfigService.delete(id, tenantId)

    return c.json({
      success: true,
      message: "WhatsApp config deleted successfully",
    })
  }

  /**
   * POST /api/v1/whatsapp/:id/link-agent
   * Vincula un agente a la configuración
   */
  async linkToAgent(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    if (!body.agentId) {
      throw new HTTPException(400, { message: "agentId is required" })
    }

    const config = await whatsappConfigService.linkToAgent(id, tenantId, body.agentId)

    return c.json({
      success: true,
      data: config,
    })
  }

  /**
   * DELETE /api/v1/whatsapp/:id/unlink-agent
   * Desvincula el agente de la configuración
   */
  async unlinkFromAgent(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const config = await whatsappConfigService.unlinkFromAgent(id, tenantId)

    return c.json({
      success: true,
      data: config,
    })
  }

  /**
   * POST /api/v1/whatsapp/:id/test
   * Prueba la conexión con WhatsApp
   */
  async testConnection(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const config = await whatsappConfigService.getById(id, tenantId)

    if (!config) {
      throw new HTTPException(404, { message: "WhatsApp config not found" })
    }

    // Test connection to WhatsApp API
    try {
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${config.phoneNumberId}`,
        {
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
          },
        }
      )

      if (response.ok) {
        return c.json({
          success: true,
          message: "Connection successful",
          data: { connected: true },
        })
      } else {
        return c.json({
          success: false,
          message: "Connection failed",
          data: { connected: false },
        })
      }
    } catch (error) {
      return c.json({
        success: false,
        message: "Connection failed",
        data: { connected: false, error: String(error) },
      })
    }
  }
}

export const whatsappConfigController = new WhatsAppConfigController()
