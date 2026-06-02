/**
 * Chat Service - Maneja conversaciones y mensajes con Drizzle ORM
 */

import { eq, and, desc, sql, inArray } from "drizzle-orm"
import { db } from "../../../db"
import { conversations, messages, agents, whatsappConfigs } from "../../../db/schema"
import type { Conversation, Message } from "../../../db/schema"
import type { ConversationStatus, MessageDirection, MessageType } from "../../../db/schema/enums"

export interface CreateConversationInput {
  tenantId: string
  agentId?: string
  configId: string
  phoneNumber: string
  contactName?: string
  contactEmail?: string
}

export interface UpdateConversationInput {
  contactName?: string
  contactEmail?: string
  status?: ConversationStatus
  tags?: string[]
}

export interface SendMessageInput {
  conversationId: string
  tenantId: string
  content: string
  type?: MessageType
  direction?: MessageDirection
  messageId?: string
  inReplyTo?: string
  metadata?: Record<string, unknown>
}

export interface ConversationFilterOptions {
  tenantId: string
  agentId?: string
  configId?: string
  status?: ConversationStatus
  search?: string
  page?: number
  limit?: number
}

class ChatService {
  /**
   * Crear una nueva conversacion
   */
  async create(data: CreateConversationInput): Promise<Conversation> {
    // Verificar que el config existe y pertenece al tenant
    const config = await db.query.whatsappConfigs.findFirst({
      where: and(
        eq(whatsappConfigs.id, data.configId),
        eq(whatsappConfigs.tenantId, data.tenantId)
      ),
    })

    if (!config) {
      throw new Error("Configuracion de WhatsApp no encontrada")
    }

    // Verificar si ya existe una conversacion activa para este telefono y config
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.tenantId, data.tenantId),
        eq(conversations.phoneNumber, data.phoneNumber),
        eq(conversations.configId, data.configId),
        sql`${conversations.status} NOT IN ('ARCHIVED', 'CLOSED')`
      ),
    })

    if (existing) {
      // Actualizar la conversacion existente
      const [updated] = await db
        .update(conversations)
        .set({
          contactName: data.contactName || existing.contactName,
          contactEmail: data.contactEmail || existing.contactEmail,
          updatedAt: new Date(),
        } as any)
        .where(eq(conversations.id, existing.id))
        .returning()

      return updated
    }

    const [conversation] = await db
      .insert(conversations)
      .values({
        tenantId: data.tenantId,
        agentId: data.agentId || config.agentId,
        configId: data.configId,
        phoneNumber: data.phoneNumber,
        contactName: data.contactName,
        contactEmail: data.contactEmail,
        status: "ACTIVE",
        messageCount: 0,
        tags: [],
      } as any)
      .returning()

    return conversation
  }

  /**
   * Obtener conversacion por ID con mensajes
   */
  async getById(id: string, tenantId: string, includeMessages = true) {
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId)
      ),
      with: {
        agent: true,
        config: true,
      },
    })

    if (!conversation) {
      return null
    }

    let conversationMessages: Message[] = []
    if (includeMessages) {
      conversationMessages = await db.query.messages.findMany({
        where: eq(messages.conversationId, id),
        orderBy: [desc(messages.createdAt)],
        limit: 100,
      })
    }

    return {
      ...conversation,
      messages: conversationMessages,
    }
  }

  /**
   * Listar conversaciones con filtros y paginacion
   */
  async list(options: ConversationFilterOptions) {
    const { tenantId, agentId, configId, status, search, page = 1, limit = 20 } = options
    const offset = (page - 1) * limit

    const conditions = [eq(conversations.tenantId, tenantId)]

    if (agentId) {
      conditions.push(eq(conversations.agentId, agentId))
    }
    if (configId) {
      conditions.push(eq(conversations.configId, configId))
    }
    if (status) {
      conditions.push(eq(conversations.status, status))
    }

    const allConversations = await db.query.conversations.findMany({
      where: and(...conditions),
      with: {
        agent: true,
        config: true,
      },
      orderBy: [desc(conversations.lastMessageAt), desc(conversations.updatedAt)],
    })

    // Filtrar por busqueda si existe
    let filtered = allConversations
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = allConversations.filter(
        (c) =>
          c.contactName?.toLowerCase().includes(searchLower) ||
          c.phoneNumber.toLowerCase().includes(searchLower) ||
          c.contactEmail?.toLowerCase().includes(searchLower)
      )
    }

    const total = filtered.length
    const paginated = filtered.slice(offset, offset + limit)

    return {
      conversations: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Actualizar conversacion
   */
  async update(id: string, tenantId: string, data: UpdateConversationInput): Promise<Conversation> {
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId)
      ),
    })

    if (!existing) {
      throw new Error("Conversacion no encontrada")
    }

    const [updated] = await db
      .update(conversations)
      .set({
        ...data,
        updatedAt: new Date(),
      } as any)
      .where(eq(conversations.id, id))
      .returning()

    return updated
  }

  /**
   * Archivar conversacion
   */
  async archive(id: string, tenantId: string): Promise<Conversation> {
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, id),
        eq(conversations.tenantId, tenantId)
      ),
    })

    if (!existing) {
      throw new Error("Conversacion no encontrada")
    }

    const [archived] = await db
      .update(conversations)
      .set({
        status: "ARCHIVED",
        updatedAt: new Date(),
      } as any)
      .where(eq(conversations.id, id))
      .returning()

    return archived
  }

  /**
   * Enviar mensaje a una conversacion
   */
  async sendMessage(data: SendMessageInput): Promise<Message> {
    // Verificar que la conversacion existe y pertenece al tenant
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, data.conversationId),
        eq(conversations.tenantId, data.tenantId)
      ),
    })

    if (!conversation) {
      throw new Error("Conversacion no encontrada")
    }

    const [message] = await db
      .insert(messages)
      .values({
        tenantId: data.tenantId,
        conversationId: data.conversationId,
        direction: data.direction || "OUTGOING",
        type: data.type || "TEXT",
        content: data.content,
        messageId: data.messageId,
        inReplyTo: data.inReplyTo,
        metadata: data.metadata,
        status: data.direction === "INCOMING" ? "DELIVERED" : "PENDING",
      } as any)
      .returning()

    // Actualizar la conversacion
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        messageCount: sql`${conversations.messageCount} + 1`,
        updatedAt: new Date(),
      } as any)
      .where(eq(conversations.id, data.conversationId))

    return message
  }

  /**
   * Obtener mensajes de una conversacion
   */
  async getMessages(conversationId: string, tenantId: string, options: { page?: number; limit?: number } = {}) {
    const { page = 1, limit = 50 } = options
    const offset = (page - 1) * limit

    // Verificar que la conversacion existe y pertenece al tenant
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId)
      ),
      columns: { id: true },
    })

    if (!conversation) {
      throw new Error("Conversacion no encontrada")
    }

    const allMessages = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [desc(messages.createdAt)],
    })

    const total = allMessages.length
    const paginated = allMessages.slice(offset, offset + limit)

    return {
      messages: paginated,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }
  }

  /**
   * Marcar mensajes como leidos
   */
  async markAsRead(conversationId: string, tenantId: string) {
    // Verificar que la conversacion existe y pertenece al tenant
    const conversation = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.id, conversationId),
        eq(conversations.tenantId, tenantId)
      ),
      columns: { id: true },
    })

    if (!conversation) {
      throw new Error("Conversacion no encontrada")
    }

    // Actualizar mensajes entrantes que no estan leidos
    await db
      .update(messages)
      .set({ status: "READ" } as any)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.direction, "INCOMING"),
          sql`${messages.status} NOT IN ('READ')`
        )
      )

    return { success: true, message: "Mensajes marcados como leidos" }
  }

  /**
   * Obtener conteo de mensajes no leidos
   */
  async getUnreadCount(tenantId: string, agentId?: string) {
    const conditions = [
      eq(conversations.tenantId, tenantId),
      sql`${conversations.status} NOT IN ('ARCHIVED', 'CLOSED')`,
    ]

    if (agentId) {
      conditions.push(eq(conversations.agentId, agentId))
    }

    const activeConversations = await db.query.conversations.findMany({
      where: and(...conditions),
      columns: { id: true },
    })

    const conversationIds = activeConversations.map((c) => c.id)

    if (conversationIds.length === 0) {
      return { total: 0, byConversation: [] }
    }

    // Obtener conteo por conversacion
    const unreadByConversation = await db
      .select({
        conversationId: messages.conversationId,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(messages)
      .where(
        and(
          inArray(messages.conversationId, conversationIds),
          eq(messages.direction, "INCOMING"),
          sql`${messages.status} NOT IN ('READ')`
        )
      )
      .groupBy(messages.conversationId)

    const total = unreadByConversation.reduce((sum, item) => sum + Number(item.count), 0)

    return {
      total,
      byConversation: unreadByConversation.map((item) => ({
        conversationId: item.conversationId,
        count: Number(item.count),
      })),
    }
  }

  /**
   * Obtener estadisticas de chat
   */
  async getStats(tenantId: string) {
    const allConversations = await db.query.conversations.findMany({
      where: eq(conversations.tenantId, tenantId),
      columns: { status: true },
    })

    const total = allConversations.length
    const active = allConversations.filter((c) => c.status === "ACTIVE").length
    const pendingHuman = allConversations.filter((c) => c.status === "PENDING_HUMAN").length
    const resolved = allConversations.filter((c) => c.status === "RESOLVED").length
    const closed = allConversations.filter((c) => c.status === "CLOSED").length
    const archived = allConversations.filter((c) => c.status === "ARCHIVED").length

    // Obtener total de mensajes
    const allMessages = await db.query.messages.findMany({
      where: eq(messages.tenantId, tenantId),
      columns: { direction: true },
    })

    const incoming = allMessages.filter((m) => m.direction === "INCOMING").length
    const outgoing = allMessages.filter((m) => m.direction === "OUTGOING").length

    return {
      conversations: {
        total,
        active,
        pendingHuman,
        resolved,
        closed,
        archived,
      },
      messages: {
        total: allMessages.length,
        incoming,
        outgoing,
      },
    }
  }
}

export const chatService = new ChatService()
