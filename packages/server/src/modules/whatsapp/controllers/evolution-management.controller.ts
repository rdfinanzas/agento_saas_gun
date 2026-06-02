/**
 * Evolution API Management Controller
 *
 * Endpoints para gestionar instancias de WhatsApp via Evolution API.
 * Estos endpoints son llamados desde el frontend de onboarding y settings.
 *
 * Requiere autenticacion (authMiddleware).
 */

import type { Context } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../../db"
import { whatsappConfigs } from "../../../db/schema"
import { evolutionService, type EvolutionConfig } from "../adapters/evolution/evolution.service"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("evolution-management")

// Helper: resolver Evolution config desde la whatsapp config del tenant
function getEvolutionConfig(config: any): EvolutionConfig {
  // Usar la config del tenant si tiene, sino la global del env
  return {
    baseUrl: config.evolutionApiUrl || process.env.EVOLUTION_API_URL || "http://localhost:8080",
    apiKey: config.evolutionApiKey || process.env.EVOLUTION_API_KEY || "",
  }
}

class EvolutionManagementController {
  /**
   * POST /api/v1/whatsapp/evolution/create-instance
   *
   * Crea una nueva instancia de WhatsApp en Evolution API
   * y actualiza la whatsapp config del tenant.
   */
  async createInstance(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const body = await c.req.json()
      const instanceName = body.instanceName || `tenant-${tenantId.substring(0, 8)}`
      const agentId = body.agentId || null

      // Buscar config existente para este agente (o del tenant)
      let config = agentId
        ? await db.query.whatsappConfigs.findFirst({
            where: eq(whatsappConfigs.agentId, agentId),
          })
        : await db.query.whatsappConfigs.findFirst({
            where: eq(whatsappConfigs.tenantId, tenantId),
          })

      const evoConfig = getEvolutionConfig(config || {})

      // Si ya existe config con instance, reconectar para obtener QR
      let qrCode: string | null = null
      if (config?.evolutionInstanceName) {
        try {
          const qr = await evolutionService.connectInstance(evoConfig, config.evolutionInstanceName)
          qrCode = qr.base64 || null
        } catch {
          // Si falla reconnect, intentar crear nueva abajo
        }
        if (qrCode) {
          logger.info("Reusing existing instance", { tenantId, instanceName: config.evolutionInstanceName })
          return c.json({
            success: true,
            instanceName: config.evolutionInstanceName,
            qrCode,
            status: "connecting",
            configId: config.id,
          })
        }
      }

      // Crear instancia en Evolution API (si no existe una previa)
      let instance
      try {
        instance = await evolutionService.createInstance(evoConfig, instanceName, tenantId)
      } catch (createErr: any) {
        // Si ya existe (403), intentar reconectar
        if (createErr?.response?.status === 403 || String(createErr?.message).includes("403")) {
          try {
            const qr = await evolutionService.connectInstance(evoConfig, instanceName)
            qrCode = qr.base64 || null
          } catch {}
        }
        if (!qrCode) throw createErr
      }

      // Obtener QR code si no lo tenemos
      if (!qrCode) {
        try {
          const qr = await evolutionService.connectInstance(evoConfig, instanceName)
          qrCode = qr.base64 || null
        } catch {
          // QR puede no estar disponible inmediatamente
        }
      }

      // Actualizar o crear whatsapp config con los datos de Evolution
      if (config) {
        await db
          .update(whatsappConfigs)
          .set({
            evolutionInstanceName: instanceName,
            evolutionApiUrl: evoConfig.baseUrl,
            evolutionApiKey: evoConfig.apiKey,
            connectionType: "EVOLUTION_API",
            connectionStatus: "CONNECTING",
            phoneNumberId: config.phoneNumberId || `evo-${instanceName}`,
            accessToken: config.accessToken || `evo-managed`,
            webhookVerifyToken: config.webhookVerifyToken || `evo-verify`,
            agentId: agentId || config.agentId,
            updatedAt: new Date(),
          } as any)
          .where(eq(whatsappConfigs.id, config.id))
      } else {
        // Crear nueva config
        const [newConfig] = await db
          .insert(whatsappConfigs)
          .values({
            tenantId,
            phoneNumberId: `evo-${instanceName}`,
            phoneNumber: "",
            accessToken: "evo-managed",
            webhookVerifyToken: "evo-verify",
            connectionType: "EVOLUTION_API",
            connectionStatus: "CONNECTING",
            evolutionInstanceName: instanceName,
            evolutionApiUrl: evoConfig.baseUrl,
            evolutionApiKey: evoConfig.apiKey,
            isActive: true,
            agentMode: "LIMITED",
            allowedTools: ["searchProducts", "getProductDetails", "checkStock", "findCustomer", "createCustomer", "createOrder"],
            blockedTools: [],
            approvalKeywords: [],
            agentId: agentId,
          } as any)
          .returning()

        config = newConfig
      }

      logger.info("Instance created", { tenantId, instanceName })

      return c.json({
        success: true,
        instanceName,
        instanceId: instance.instanceId,
        qrCode,
        status: "connecting",
        configId: config?.id,
      })
    } catch (error: any) {
      logger.error("createInstance failed", { error: error.message })
      return c.json({ success: false, error: error.message }, 500)
    }
  }

  /**
   * GET /api/v1/whatsapp/evolution/qr/:instanceName
   *
   * Obtiene el QR code actualizado para escanear
   */
  async getQRCode(c: Context) {
    try {
      const instanceName = c.req.param("instanceName")
      const tenantId = c.get("tenantId") as string

      const config = await db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.tenantId, tenantId),
      })

      if (!config) {
        return c.json({ success: false, error: "No config found" }, 404)
      }

      const evoConfig = getEvolutionConfig(config)
      const qr = await evolutionService.connectInstance(evoConfig, instanceName)

      return c.json({
        success: true,
        qrCode: qr.base64,
        code: qr.code,
      })
    } catch (error: any) {
      logger.error("getQRCode failed", { error: error.message })
      return c.json({ success: false, error: error.message }, 500)
    }
  }

  /**
   * GET /api/v1/whatsapp/evolution/status/:instanceName
   *
   * Obtiene el estado de conexion de la instancia
   */
  async getStatus(c: Context) {
    try {
      const instanceName = c.req.param("instanceName")
      const tenantId = c.get("tenantId") as string

      const config = await db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.tenantId, tenantId),
      })

      if (!config) {
        return c.json({ success: false, error: "No config found" }, 404)
      }

      const evoConfig = getEvolutionConfig(config)
      const instance = await evolutionService.getInstanceStatus(evoConfig, instanceName)

      // Actualizar estado en la DB
      if (instance.status === "open" && config.connectionStatus !== "CONNECTED") {
        await db
          .update(whatsappConfigs)
          .set({
            connectionStatus: "CONNECTED",
            phoneNumber: instance.ownerJid?.replace("@s.whatsapp.net", "") || config.phoneNumber,
            updatedAt: new Date(),
          } as any)
          .where(eq(whatsappConfigs.id, config.id))
      }

      return c.json({
        success: true,
        status: instance.status,
        connectionStatus: instance.connectionStatus,
        profileName: instance.profileName,
        phoneNumber: instance.ownerJid?.replace("@s.whatsapp.net", ""),
      })
    } catch (error: any) {
      logger.error("getStatus failed", { error: error.message })
      return c.json({ success: false, error: error.message }, 500)
    }
  }

  /**
   * POST /api/v1/whatsapp/evolution/disconnect/:instanceName
   *
   * Desconecta la instancia (logout)
   */
  async disconnect(c: Context) {
    try {
      const instanceName = c.req.param("instanceName")
      const tenantId = c.get("tenantId") as string

      const config = await db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.tenantId, tenantId),
      })

      if (!config) {
        return c.json({ success: false, error: "No config found" }, 404)
      }

      const evoConfig = getEvolutionConfig(config)
      await evolutionService.logoutInstance(evoConfig, instanceName)

      // Actualizar estado en DB
      await db
        .update(whatsappConfigs)
        .set({
          connectionStatus: "DISCONNECTED",
          updatedAt: new Date(),
        } as any)
        .where(eq(whatsappConfigs.id, config.id))

      return c.json({ success: true })
    } catch (error: any) {
      logger.error("disconnect failed", { error: error.message })
      return c.json({ success: false, error: error.message }, 500)
    }
  }

  /**
   * DELETE /api/v1/whatsapp/evolution/:instanceName
   *
   * Elimina la instancia completamente
   */
  async deleteInstance(c: Context) {
    try {
      const instanceName = c.req.param("instanceName")
      const tenantId = c.get("tenantId") as string

      const config = await db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.tenantId, tenantId),
      })

      if (!config) {
        return c.json({ success: false, error: "No config found" }, 404)
      }

      const evoConfig = getEvolutionConfig(config)
      await evolutionService.deleteInstance(evoConfig, instanceName)

      // Actualizar DB
      await db
        .update(whatsappConfigs)
        .set({
          connectionStatus: "DISCONNECTED",
          evolutionInstanceName: null,
          updatedAt: new Date(),
        } as any)
        .where(eq(whatsappConfigs.id, config.id))

      return c.json({ success: true })
    } catch (error: any) {
      logger.error("deleteInstance failed", { error: error.message })
      return c.json({ success: false, error: error.message }, 500)
    }
  }
}

export const evolutionManagementController = new EvolutionManagementController()
