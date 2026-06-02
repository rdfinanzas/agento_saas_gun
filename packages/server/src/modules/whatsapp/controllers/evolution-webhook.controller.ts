/**
 * Evolution API Webhook Controller
 *
 * Recibe webhooks de Evolution API / WAHA y los procesa.
 * Ruta: POST /api/v1/whatsapp/evolution/webhook
 *
 * No requiere auth - Evolution API llama este endpoint directamente.
 */

import type { Context } from "hono"
import { eq } from "drizzle-orm"
import { db } from "../../../db"
import { whatsappConfigs } from "../../../db/schema"
import { evolutionService, type EvolutionWebhookData } from "../adapters/evolution/evolution.service"
import { conversationEngine, type IncomingMessage } from "../../ai/conversation-engine"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("evolution-webhook")

class EvolutionWebhookController {
  /**
   * POST /api/v1/whatsapp/evolution/webhook
   *
   * Recibe webhooks de Evolution API.
   * Evolution envia POST para cada evento (mensajes, conexion, etc.)
   */
  async handleWebhook(c: Context) {
    try {
      const payload = await c.req.json<EvolutionWebhookData>()

      // Manejar eventos de conexion/desconexion
      if (payload.event === "connection.update" || payload.event === "CONNECTION_UPDATE") {
        const instance = payload.instance
        const state = payload.data?.state || payload.data?.status || ""

        if (instance && state) {
          let dbStatus = "CONNECTING"
          if (state === "open") dbStatus = "CONNECTED"
          else if (state === "close") dbStatus = "DISCONNECTED"

          try {
            await db
              .update(whatsappConfigs)
              .set({ connectionStatus: dbStatus, updatedAt: new Date() } as any)
              .where(eq(whatsappConfigs.evolutionInstanceName, instance))
            logger.info("Connection status updated", { instance, state, dbStatus })
          } catch (err) {
            logger.error("Failed to update connection status", { instance, error: String(err) })
          }
        }
        return c.json({ ok: true })
      }

      // Parsear el mensaje
      const parsed = evolutionService.parseWebhookMessage(payload)

      if (!parsed) {
        // Evento que no es mensaje (QR, etc.)
        logger.debug("Non-message event received", {
          event: payload.event,
          instance: payload.instance,
        })
        return c.json({ ok: true })
      }

      // Ignorar mensajes propios (de nosotros hacia el cliente)
      if (parsed.fromMe) {
        return c.json({ ok: true })
      }

      // Ignorar mensajes vacios
      if (!parsed.messageText || parsed.messageText.trim() === "") {
        return c.json({ ok: true })
      }

      logger.info("Incoming WhatsApp message", {
        instance: parsed.instanceName,
        phone: parsed.phoneNumber,
        type: parsed.messageType,
        textLength: parsed.messageText.length,
      })

      // Verificar si el agente esta activo (no pausado)
      try {
        const config = await db.query.whatsappConfigs.findFirst({
          where: eq(whatsappConfigs.evolutionInstanceName, parsed.instanceName),
        })
        if (config && config.isActive === false) {
          logger.info("Agent is paused, ignoring message", { instance: parsed.instanceName })
          return c.json({ ok: true, paused: true })
        }
      } catch {}

      // Procesar en background - no bloquear la respuesta al webhook
      // Evolution API espera respuesta rapida (200 OK)
      // Fire and forget - Bun no tiene ExecutionContext como Cloudflare Workers
      this.processIncomingMessage(parsed).catch((err) => {
        logger.error("Background processing error", {
          phone: parsed.phoneNumber,
          error: err instanceof Error ? err.message : String(err),
        })
      })

      return c.json({ ok: true })
    } catch (error) {
      logger.error("Webhook processing error", {
        error: error instanceof Error ? error.message : String(error),
      })
      return c.json({ ok: true }) // Siempre devolver 200 a Evolution
    }
  }

  /**
   * Procesa un mensaje entrante a traves del Conversation Engine
   */
  private async processIncomingMessage(parsed: {
    instanceName: string
    phoneNumber: string
    messageText: string
    messageType: string
    pushName?: string
    messageId: string
  }): Promise<void> {
    const input: IncomingMessage = {
      tenantId: "", // Se resuelve via instanceName en conversationEngine
      instanceName: parsed.instanceName,
      phoneNumber: parsed.phoneNumber,
      messageText: parsed.messageText,
      messageType: parsed.messageType,
      pushName: parsed.pushName,
      messageId: parsed.messageId,
    }

    const result = await conversationEngine.processMessage(input)

    if (!result.success) {
      logger.error("Failed to process message", {
        phone: parsed.phoneNumber,
        error: result.error,
      })
    }
  }
}

export const evolutionWebhookController = new EvolutionWebhookController()
