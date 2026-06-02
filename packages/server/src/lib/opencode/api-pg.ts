/**
 * OpenCode PostgreSQL API
 *
 * Reemplaza la API de SQLite de OpenCode con PostgreSQL usando Drizzle ORM.
 * Esta API proporciona almacenamiento de sesiones y mensajes en PostgreSQL.
 */

import { db } from "@/db"
import { agentSessions, type AgentSession, type NewAgentSession, type AgentSessionMetadata } from "@/db/schema/agent-session"
import { agentMessages, type AgentMessage, type NewAgentMessage, type MessagePart, type AgentMessageMetadata } from "@/db/schema/agent-message"
import { eq, and, desc, asc } from "drizzle-orm"

/**
 * Store para manejar sesiones de agente en PostgreSQL
 */
export class PostgresSessionStore {
  
  /**
   * Crea una nueva sesión
   */
  async create(data: {
    tenantId: string
    userId?: string
    agentId?: string
    title?: string
    directory?: string
    metadata?: AgentSessionMetadata
  }): Promise<AgentSession> {
    const [session] = await db.insert(agentSessions).values({
      tenantId: data.tenantId,
      userId: data.userId,
      agentId: data.agentId,
      title: data.title,
      directory: data.directory,
      metadata: data.metadata || {},
      isActive: true,
      isArchived: false,
    }).returning()
    
    return session
  }
  
  /**
   * Obtiene una sesión por ID
   */
  async get(id: string): Promise<AgentSession | null> {
    const session = await db.query.agentSessions.findFirst({
      where: eq(agentSessions.id, id),
    })
    return session || null
  }
  
  /**
   * Obtiene una sesión por ID validando el tenant
   */
  async getWithTenant(id: string, tenantId: string): Promise<AgentSession | null> {
    const session = await db.query.agentSessions.findFirst({
      where: and(
        eq(agentSessions.id, id),
        eq(agentSessions.tenantId, tenantId)
      ),
    })
    return session || null
  }
  
  /**
   * Lista sesiones de un tenant
   */
  async list(tenantId: string, options?: { 
    limit?: number
    includeArchived?: boolean
    userId?: string
  }): Promise<AgentSession[]> {
    const conditions = [eq(agentSessions.tenantId, tenantId)]
    
    if (!options?.includeArchived) {
      conditions.push(eq(agentSessions.isArchived, false))
    }
    
    if (options?.userId) {
      conditions.push(eq(agentSessions.userId, options.userId))
    }
    
    return db.query.agentSessions.findMany({
      where: and(...conditions),
      orderBy: [desc(agentSessions.updatedAt)],
      limit: options?.limit,
    })
  }
  
  /**
   * Actualiza una sesión
   */
  async update(
    id: string, 
    tenantId: string, 
    data: Partial<Omit<NewAgentSession, 'id' | 'tenantId' | 'createdAt'>>
  ): Promise<AgentSession | null> {
    const [session] = await db.update(agentSessions)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(
        eq(agentSessions.id, id),
        eq(agentSessions.tenantId, tenantId)
      ))
      .returning()
    
    return session || null
  }
  
  /**
   * Archiva una sesión
   */
  async archive(id: string, tenantId: string): Promise<AgentSession | null> {
    const [session] = await db.update(agentSessions)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(agentSessions.id, id),
        eq(agentSessions.tenantId, tenantId)
      ))
      .returning()
    
    return session || null
  }
  
  /**
   * Elimina una sesión y sus mensajes
   */
  async delete(id: string, tenantId: string): Promise<boolean> {
    // Primero eliminar mensajes
    await db.delete(agentMessages)
      .where(eq(agentMessages.sessionId, id))
    
    // Luego eliminar sesión
    const result = await db.delete(agentSessions)
      .where(and(
        eq(agentSessions.id, id),
        eq(agentSessions.tenantId, tenantId)
      ))
    
    return true
  }
  
  /**
   * Agrega un mensaje a una sesión
   */
  async addMessage(
    sessionId: string,
    tenantId: string,
    message: {
      role: string
      content?: string
      toolName?: string
      toolCallId?: string
      toolInput?: unknown
      toolOutput?: unknown
      parts?: MessagePart[]
      metadata?: AgentMessageMetadata
    }
  ): Promise<AgentMessage> {
    const [result] = await db.insert(agentMessages).values({
      sessionId,
      tenantId,
      role: message.role,
      content: message.content,
      toolName: message.toolName,
      toolCallId: message.toolCallId,
      toolInput: message.toolInput,
      toolOutput: message.toolOutput,
      parts: message.parts || [],
      metadata: message.metadata,
    }).returning()
    
    // Actualizar timestamp de la sesión
    await db.update(agentSessions)
      .set({ updatedAt: new Date() })
      .where(eq(agentSessions.id, sessionId))
    
    return result
  }
  
  /**
   * Obtiene mensajes de una sesión
   */
  async getMessages(sessionId: string, options?: { limit?: number }): Promise<AgentMessage[]> {
    return db.query.agentMessages.findMany({
      where: eq(agentMessages.sessionId, sessionId),
      orderBy: [asc(agentMessages.createdAt)],
      limit: options?.limit,
    })
  }
  
  /**
   * Obtiene mensajes de una sesión validando tenant
   */
  async getMessagesWithTenant(
    sessionId: string, 
    tenantId: string, 
    options?: { limit?: number }
  ): Promise<AgentMessage[]> {
    // Verificar que la sesión pertenece al tenant
    const session = await this.getWithTenant(sessionId, tenantId)
    if (!session) {
      throw new Error("Session not found or access denied")
    }
    
    return this.getMessages(sessionId, options)
  }
}

/**
 * Instancia singleton del store
 */
export const sessionStore = new PostgresSessionStore()

/**
 * Bus para eventos de OpenCode
 */
export type EventHandler = (event: unknown) => void | Promise<void>

export class EventBus {
  private handlers: Set<EventHandler> = new Set()
  
  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
  
  subscribeAll(handler: EventHandler): () => void {
    return this.subscribe(handler)
  }
  
  emit(event: unknown): void {
    for (const handler of this.handlers) {
      try {
        handler(event)
      } catch (error) {
        console.error("Error in event handler:", error)
      }
    }
  }
}

export const Bus = new EventBus()
