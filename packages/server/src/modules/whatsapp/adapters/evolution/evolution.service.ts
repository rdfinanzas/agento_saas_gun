/**
 * Evolution API Service
 *
 * Cliente HTTP para la Evolution API / WAHA que corre en el VPS.
 * Maneja: crear instancias, conectar via QR, enviar/recibir mensajes.
 */

import axios, { type AxiosInstance } from "axios"
import { createLogger } from "../../../../utils/logger"

const logger = createLogger("evolution-api")

// ─── TIPOS ────────────────────────────────────────────────────

export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
}

export interface EvolutionInstance {
  instanceName: string
  instanceId: string
  status: "open" | "close" | "connecting" | "disconnected"
  connectionStatus: string
  ownerJid?: string
  profileName?: string
  profilePicUrl?: string
}

export interface EvolutionQRCode {
  code?: string
  base64?: string
}

export interface EvolutionMessage {
  key: {
    remoteJid: string
    fromMe: boolean
    id: string
  }
  message: {
    conversation?: string
    extendedTextMessage?: { text: string }
    imageMessage?: { caption?: string; url: string; mimetype: string }
    documentMessage?: { caption?: string; url: string; mimetype: string; fileName?: string }
    audioMessage?: { url: string; mimetype: string }
    videoMessage?: { caption?: string; url: string; mimetype: string }
    stickerMessage?: { url: string }
    contactMessage?: { displayName: string; vcard: string }
    locationMessage?: { degreesLatitude: number; degreesLongitude: number; name?: string }
    buttonsResponseMessage?: { selectedDisplayText: string; selectedIndex: number }
    listResponseMessage?: { title: string; description?: string; singleSelectReply: { selectedRowId: string } }
  }
  messageTimestamp: number
  pushName?: string
}

export interface EvolutionWebhookData {
  event: string
  instance: string
  data: EvolutionMessage | Record<string, unknown>
  sender?: string
}

export interface SendTextMessageInput {
  number: string
  text: string
  delay?: number
  linkPreview?: boolean
}

export interface SendMediaMessageInput {
  number: string
  mediatype: "image" | "document" | "audio" | "video" | "sticker"
  media: string // URL o base64
  caption?: string
  fileName?: string
  delay?: number
}

// ─── SERVICE ──────────────────────────────────────────────────

class EvolutionAPIService {
  private clients: Map<string, AxiosInstance> = new Map()

  /**
   * Obtiene un cliente HTTP configurado para una instancia de Evolution API
   */
  private getClient(config: EvolutionConfig): AxiosInstance {
    const cacheKey = `${config.baseUrl}:${config.apiKey}`
    let client = this.clients.get(cacheKey)

    if (!client) {
      client = axios.create({
        baseURL: config.baseUrl,
        headers: {
          apikey: config.apiKey,
          "Content-Type": "application/json",
        },
        timeout: 60000,
      })
      this.clients.set(cacheKey, client)
    }

    return client
  }

  /**
   * Crea una nueva instancia de WhatsApp en Evolution API
   */
  async createInstance(config: EvolutionConfig, instanceName: string, tenantId: string): Promise<EvolutionInstance> {
    const client = this.getClient(config)

    try {
      const { data } = await client.post("/instance/create", {
        instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS",
        webhook: {
          enabled: true,
          url: `${process.env.SERVER_URL || "http://localhost:3001"}/api/v1/whatsapp/evolution/webhook`,
          webhookByEvents: true,
          events: [
            "MESSAGES_UPSERT",
            "CONNECTION_UPDATE",
            "QRCODE_UPDATED",
          ],
        },
        settings: {
          rejectCall: true,
          msgCall: "Lo siento, no puedo recibir llamadas. Escribime por WhatsApp.",
          groupsIgnore: true,
          alwaysOnline: true,
          readMessages: true,
          syncFullHistory: false,
        },
      })

      logger.info("Instance created", { instanceName, tenantId })

      return {
        instanceName,
        instanceId: data.instance?.id || data.id || "",
        status: "connecting",
        connectionStatus: "connecting",
      }
    } catch (error: any) {
      logger.error("Failed to create instance", {
        instanceName,
        error: error.response?.data || error.message,
      })
      throw new Error(`Error creando instancia: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Conecta una instancia y obtiene el QR code
   */
  async connectInstance(config: EvolutionConfig, instanceName: string): Promise<EvolutionQRCode> {
    const client = this.getClient(config)

    try {
      const { data } = await client.get(`/instance/connect/${instanceName}`)

      return {
        code: data.code || data.qrcode?.code,
        base64: data.base64 || data.qrcode?.base64,
      }
    } catch (error: any) {
      logger.error("Failed to connect instance", {
        instanceName,
        error: error.response?.data || error.message,
      })
      throw new Error(`Error conectando instancia: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Obtiene el estado de conexion de una instancia
   */
  async getInstanceStatus(config: EvolutionConfig, instanceName: string): Promise<EvolutionInstance> {
    const client = this.getClient(config)

    try {
      const { data } = await client.get(`/instance/fetchInstances?instanceName=${instanceName}`)

      const instance = Array.isArray(data) ? data[0] : data

      return {
        instanceName: instance?.instanceName || instanceName,
        instanceId: instance?.instanceId || instance?.id || "",
        status: instance?.connectionStatus === "open" ? "open" : "close",
        connectionStatus: instance?.connectionStatus || "disconnected",
        ownerJid: instance?.ownerJid,
        profileName: instance?.profileName,
        profilePicUrl: instance?.profilePicUrl,
      }
    } catch (error: any) {
      return {
        instanceName,
        instanceId: "",
        status: "disconnected",
        connectionStatus: "error",
      }
    }
  }

  /**
   * Envia un mensaje de texto
   */
  async sendTextMessage(config: EvolutionConfig, instanceName: string, input: SendTextMessageInput): Promise<{ messageId: string }> {
    const client = this.getClient(config)

    try {
      // Formatear numero: asegurar que tiene @s.whatsapp.net
      let number = input.number.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "")
      if (!number.includes("@")) {
        number = `${number}@s.whatsapp.net`
      }

      const { data } = await client.post(`/message/sendText/${instanceName}`, {
        number,
        text: input.text,
        delay: input.delay || 0,
        linkPreview: input.linkPreview ?? false,
      })

      return { messageId: data?.key?.id || data?.messageId || "" }
    } catch (error: any) {
      logger.error("Failed to send text message", {
        instanceName,
        number: input.number,
        error: error.response?.data || error.message,
      })
      throw new Error(`Error enviando mensaje: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Envia un mensaje con media (imagen, documento, audio, video)
   */
  async sendMediaMessage(config: EvolutionConfig, instanceName: string, input: SendMediaMessageInput): Promise<{ messageId: string }> {
    const client = this.getClient(config)

    try {
      let number = input.number.replace("@s.whatsapp.net", "").replace(/[^0-9]/g, "")
      if (!number.includes("@")) {
        number = `${number}@s.whatsapp.net`
      }

      const payload: Record<string, unknown> = {
        number,
        mediatype: input.mediatype,
        media: input.media,
        delay: input.delay || 0,
      }

      if (input.caption) payload.caption = input.caption
      if (input.fileName) payload.fileName = input.fileName

      const { data } = await client.post(`/message/sendMedia/${instanceName}`, payload)

      return { messageId: data?.key?.id || data?.messageId || "" }
    } catch (error: any) {
      logger.error("Failed to send media message", {
        instanceName,
        number: input.number,
        error: error.response?.data || error.message,
      })
      throw new Error(`Error enviando media: ${error.response?.data?.message || error.message}`)
    }
  }

  /**
   * Desconecta una instancia (logout)
   */
  async logoutInstance(config: EvolutionConfig, instanceName: string): Promise<void> {
    const client = this.getClient(config)

    try {
      await client.delete(`/instance/logout/${instanceName}`)
      logger.info("Instance logged out", { instanceName })
    } catch (error: any) {
      logger.error("Failed to logout instance", {
        instanceName,
        error: error.response?.data || error.message,
      })
    }
  }

  /**
   * Elimina una instancia
   */
  async deleteInstance(config: EvolutionConfig, instanceName: string): Promise<void> {
    const client = this.getClient(config)

    try {
      await client.delete(`/instance/delete/${instanceName}`)
      logger.info("Instance deleted", { instanceName })
    } catch (error: any) {
      logger.error("Failed to delete instance", {
        instanceName,
        error: error.response?.data || error.message,
      })
    }
  }

  /**
   * Parsea un webhook entrante de Evolution API y extrae los datos normalizados
   */
  parseWebhookMessage(webhookData: EvolutionWebhookData): {
    instanceName: string
    event: string
    phoneNumber: string
    messageText: string
    messageType: "text" | "image" | "audio" | "document" | "video" | "location" | "contact" | "buttons" | "list" | "unknown"
    mediaUrl?: string
    caption?: string
    pushName?: string
    messageId: string
    fromMe: boolean
    timestamp: Date
    raw: EvolutionMessage
  } | null {
    const { event, instance, data } = webhookData

    // Solo procesar mensajes entrantes
    if (event !== "messages.upsert" && event !== "MESSAGES_UPSERT") {
      return null
    }

    const msg = data as EvolutionMessage

    // Ignorar mensajes propios
    if (msg.key?.fromMe) {
      return null
    }

    // Extraer texto del mensaje
    let messageText = ""
    let messageType: typeof result.messageType = "unknown"
    let mediaUrl: string | undefined
    let caption: string | undefined

    if (msg.message?.conversation) {
      messageText = msg.message.conversation
      messageType = "text"
    } else if (msg.message?.extendedTextMessage?.text) {
      messageText = msg.message.extendedTextMessage.text
      messageType = "text"
    } else if (msg.message?.imageMessage) {
      messageType = "image"
      caption = msg.message.imageMessage.caption
      messageText = caption || "[Imagen]"
      mediaUrl = msg.message.imageMessage.url
    } else if (msg.message?.documentMessage) {
      messageType = "document"
      caption = msg.message.documentMessage.caption
      messageText = caption || `[Documento: ${msg.message.documentMessage.fileName || "archivo"}]`
      mediaUrl = msg.message.documentMessage.url
    } else if (msg.message?.audioMessage) {
      messageType = "audio"
      messageText = "[Audio]"
      mediaUrl = msg.message.audioMessage.url
    } else if (msg.message?.videoMessage) {
      messageType = "video"
      caption = msg.message.videoMessage.caption
      messageText = caption || "[Video]"
      mediaUrl = msg.message.videoMessage.url
    } else if (msg.message?.locationMessage) {
      messageType = "location"
      const lat = msg.message.locationMessage.degreesLatitude
      const lng = msg.message.locationMessage.degreesLongitude
      messageText = `[Ubicacion: ${lat}, ${lng}]${msg.message.locationMessage.name ? ` - ${msg.message.locationMessage.name}` : ""}`
    } else if (msg.message?.contactMessage) {
      messageType = "contact"
      messageText = `[Contacto: ${msg.message.contactMessage.displayName}]`
    } else if (msg.message?.buttonsResponseMessage) {
      messageType = "buttons"
      messageText = msg.message.buttonsResponseMessage.selectedDisplayText
    } else if (msg.message?.listResponseMessage) {
      messageType = "list"
      messageText = msg.message.listResponseMessage.title
    }

    const result = {
      instanceName: instance,
      event,
      phoneNumber: msg.key?.remoteJid?.replace("@s.whatsapp.net", "") || "",
      messageText,
      messageType,
      mediaUrl,
      caption,
      pushName: msg.pushName,
      messageId: msg.key?.id || "",
      fromMe: msg.key?.fromMe || false,
      timestamp: new Date(Number(msg.messageTimestamp) * 1000),
      raw: msg,
    }

    return result
  }
}

export const evolutionService = new EvolutionAPIService()
