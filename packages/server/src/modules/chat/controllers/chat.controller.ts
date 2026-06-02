/**
 * Chat Controller - Maneja las peticiones HTTP del modulo de chat
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { chatService } from "../services/chat.service"

export class ChatController {
  /**
   * GET /api/v1/chat/conversations
   * Lista conversaciones con filtros
   */
  async listConversations(c: Context) {
    const tenantId = c.get("tenantId") as string
    const agentId = c.req.query("agentId")
    const configId = c.req.query("configId")
    const status = c.req.query("status") as string | undefined
    const search = c.req.query("search")
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")

    const result = await chatService.list({
      tenantId,
      agentId,
      configId,
      status: status as any,
      search,
      page,
      limit,
    })

    return c.json({
      success: true,
      data: result.conversations,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    })
  }

  /**
   * GET /api/v1/chat/conversations/:id
   * Obtiene una conversacion por ID con mensajes
   */
  async getConversationById(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const includeMessages = c.req.query("includeMessages") !== "false"

    const conversation = await chatService.getById(id, tenantId, includeMessages)

    if (!conversation) {
      throw new HTTPException(404, { message: "Conversacion no encontrada" })
    }

    return c.json({
      success: true,
      data: conversation,
    })
  }

  /**
   * POST /api/v1/chat/conversations
   * Crea una nueva conversacion
   */
  async createConversation(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()

    const conversation = await chatService.create({
      tenantId,
      ...body,
    })

    return c.json({
      success: true,
      data: conversation,
    }, 201)
  }

  /**
   * PUT /api/v1/chat/conversations/:id
   * Actualiza una conversacion
   */
  async updateConversation(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    const conversation = await chatService.update(id, tenantId, body)

    return c.json({
      success: true,
      data: conversation,
    })
  }

  /**
   * POST /api/v1/chat/conversations/:id/archive
   * Archiva una conversacion
   */
  async archiveConversation(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    const conversation = await chatService.archive(id, tenantId)

    return c.json({
      success: true,
      data: conversation,
      message: "Conversacion archivada correctamente",
    })
  }

  /**
   * POST /api/v1/chat/conversations/:id/messages
   * Envia un mensaje a una conversacion
   */
  async sendMessage(c: Context) {
    const tenantId = c.get("tenantId") as string
    const conversationId = c.req.param("id")
    const body = await c.req.json()

    if (!body.content) {
      throw new HTTPException(400, { message: "El contenido del mensaje es requerido" })
    }

    const message = await chatService.sendMessage({
      conversationId,
      tenantId,
      content: body.content,
      type: body.type,
      direction: body.direction,
      messageId: body.messageId,
      inReplyTo: body.inReplyTo,
      metadata: body.metadata,
    })

    return c.json({
      success: true,
      data: message,
    }, 201)
  }

  /**
   * GET /api/v1/chat/conversations/:id/messages
   * Obtiene los mensajes de una conversacion
   */
  async getMessages(c: Context) {
    const tenantId = c.get("tenantId") as string
    const conversationId = c.req.param("id")
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "50")

    const result = await chatService.getMessages(conversationId, tenantId, { page, limit })

    return c.json({
      success: true,
      data: result.messages,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    })
  }

  /**
   * POST /api/v1/chat/conversations/:id/read
   * Marca los mensajes de una conversacion como leidos
   */
  async markAsRead(c: Context) {
    const tenantId = c.get("tenantId") as string
    const conversationId = c.req.param("id")

    const result = await chatService.markAsRead(conversationId, tenantId)

    return c.json({
      success: true,
      message: result.message,
    })
  }

  /**
   * GET /api/v1/chat/unread-count
   * Obtiene el conteo de mensajes no leidos
   */
  async getUnreadCount(c: Context) {
    const tenantId = c.get("tenantId") as string
    const agentId = c.req.query("agentId")

    const result = await chatService.getUnreadCount(tenantId, agentId)

    return c.json({
      success: true,
      data: result,
    })
  }

  /**
   * GET /api/v1/chat/stats
   * Obtiene estadisticas de chat
   */
  async getStats(c: Context) {
    const tenantId = c.get("tenantId") as string

    const stats = await chatService.getStats(tenantId)

    return c.json({
      success: true,
      data: stats,
    })
  }
}

export const chatController = new ChatController()
