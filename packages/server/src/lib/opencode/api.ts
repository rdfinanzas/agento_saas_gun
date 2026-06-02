/**
 * OpenCode API for AgenTo SaaS Integration
 * 
 * VERSIÓN POSTGRESQL - SP-2.5
 * 
 * Esta versión reemplaza la API SQLite original de OpenCode
 * con una implementación PostgreSQL usando Drizzle ORM.
 * 
 * Características:
 * - Multi-tenancy nativo
 * - Almacenamiento en PostgreSQL via sessionStore
 * - Eventos SSE via EventBus
 * - Integración con WorkspaceManager y CredentialManager
 */

import { sessionStore, Bus } from "./api-pg"
import { workspaceManager } from "@/modules/agent-ai/services"
import { db } from "@/db"
import { agentMessages } from "@/db/schema"
import { eq, sql } from "drizzle-orm"
import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"

/**
 * Configuration for initializing OpenCode API
 */
export interface OpenCodeConfig {
  /**
   * Base directory for workspaces
   */
  baseDataDir?: string
}

/**
 * Multi-tenant session configuration
 */
export interface TenantSessionConfig {
  /**
   * Unique tenant identifier
   */
  tenantId: string

  /**
   * User ID who created the session
   */
  userId?: string

  /**
   * Agent ID associated with this session
   */
  agentId?: string

  /**
   * Session title
   */
  title?: string

  /**
   * Custom directory for this tenant's workspace
   */
  directory?: string
}

/**
 * Prompt execution options
 */
export interface PromptOptions {
  /**
   * The prompt text to execute
   */
  prompt: string

  /**
   * AI model to use (format: "provider/model")
   */
  model?: string

  /**
   * System prompt override
   */
  system?: string

  /**
   * Callback for progress events
   */
  onProgress?: (event: any) => void
}

/**
 * Result of a prompt execution
 */
export interface PromptResult {
  /**
   * The message that was created
   */
  message: any

  /**
   * Session ID
   */
  sessionId: string

  /**
   * Tokens used (if available)
   */
  tokens?: { prompt: number; completion: number; total: number }
}

/**
 * OpenCode API class for multi-tenant SaaS integration
 * 
 * Esta implementación usa PostgreSQL en lugar de SQLite
 */
export class OpenCodeAPI {
  private initialized: boolean = false
  private config: OpenCodeConfig = {}

  /**
   * Initialize the OpenCode API
   */
  async initialize(config: OpenCodeConfig = {}): Promise<void> {
    if (this.initialized) {
      console.warn("[OpenCodeAPI] Already initialized")
      return
    }

    this.config = config
    console.log("[OpenCodeAPI] Initializing with PostgreSQL backend", config)

    this.initialized = true
    console.log("[OpenCodeAPI] Initialized successfully")
  }

  /**
   * Create a new session for a tenant
   */
  async createSession(config: TenantSessionConfig): Promise<{
    id: string
    tenantId: string
    title: string | null
    directory: string | null
    createdAt: Date
  }> {
    console.log("[OpenCodeAPI] Creating session", { tenantId: config.tenantId, userId: config.userId })
    this.ensureInitialized()

    try {
      // Asegurar que existe el workspace del tenant
      const workspacePath = await workspaceManager.getWorkspace(config.tenantId)
      console.log("[OpenCodeAPI] Workspace path:", workspacePath)

      const session = await sessionStore.create({
        tenantId: config.tenantId,
        userId: config.userId,
        agentId: config.agentId,
        title: config.title,
        directory: config.directory || workspacePath.path,
      })

      console.log("[OpenCodeAPI] Created session", {
        sessionId: session.id,
        tenantId: config.tenantId,
      })

      return {
        id: session.id,
        tenantId: session.tenantId,
        title: session.title,
        directory: session.directory,
        createdAt: session.createdAt,
      }
    } catch (error) {
      console.error("[OpenCodeAPI] Error creating session:", error)
      throw error
    }
  }

  /**
   * Execute a prompt in a session
   */
  async executePrompt(
    sessionId: string,
    tenantId: string,
    options: PromptOptions
  ): Promise<PromptResult> {
    this.ensureInitialized()

    console.log("[OpenCodeAPI] Executing prompt", {
      sessionId,
      tenantId,
      model: options.model,
    })

    // Verificar que la sesión existe y pertenece al tenant
    const session = await sessionStore.getWithTenant(sessionId, tenantId)
    if (!session) {
      throw new Error(`Session ${sessionId} not found or access denied`)
    }

    // Guardar mensaje del usuario
    const userMessage = await sessionStore.addMessage(sessionId, tenantId, {
      role: "user",
      content: options.prompt,
      metadata: {
        model: options.model,
      },
    })

    // Emitir evento de inicio
    Bus.emit({
      type: "prompt.start",
      sessionId,
      tenantId,
      messageId: userMessage.id,
      timestamp: Date.now(),
    })

    // Integración con AI SDK para generar respuesta
    let assistantContent = ""
    let promptTokens = 0
    let completionTokens = 0

    try {
      // Importar getSecureStorage para obtener el singleton
      const { getSecureStorage } = await import("@/lib/secure-storage/SecureStorage")
      const secureStorage = getSecureStorage()

      // Parsear modelo (formato: "provider/model" o "model")
      const modelParts = (options.model || "gpt-4o-mini").split("/")
      const providerName = modelParts.length > 1 ? modelParts[0] : "openai"
      const modelName = modelParts.length > 1 ? modelParts[1] : modelParts[0]

      // Buscar API key con fallback múltiple:
      // 1. Primero buscar API key específica del tenant
      // 2. Si no existe, buscar API key global ("default" tenant)
      // 3. Si no existe, buscar API key del admin tenant (como fallback del sistema)
      let credential = await secureStorage.getApiKey(tenantId, providerName)

      if (!credential || !credential.apiKey) {
        console.log("[OpenCodeAPI] No API key found for tenant, trying global default...")
        // Usar tenant "default" para API keys globales del sistema
        credential = await secureStorage.getApiKey("default", providerName)
      }

      if (!credential || !credential.apiKey) {
        console.log("[OpenCodeAPI] No global API key found, trying admin tenant...")
        // Último recurso: usar API key del tenant admin (fallback del sistema)
        credential = await secureStorage.getApiKey("9ce5057a-63c8-4f4b-8fdd-964bcf7a6b17", providerName)
      }

      if (!credential || !credential.apiKey) {
        throw new Error(`API key not found for provider ${providerName} (checked tenant ${tenantId}, global default, and admin)`)
      }

      console.log("[OpenCodeAPI] Found API key for provider", {
        provider: providerName,
        source: tenantId === "9ce5057a-63c8-4f4b-8fdd-964bcf7a6b17" ? "admin" : tenantId === "default" ? "global" : `tenant ${tenantId}`,
        apiKeyPrefix: credential.apiKey.substring(0, 10) + "...",
      })

      // Obtener historial de mensajes de la sesión
      const sessionMessages = await sessionStore.getMessages(sessionId, tenantId)

      // Convertir al formato esperado por AI SDK
      const messages = sessionMessages
        .filter(m => m.role !== "tool")
        .map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.content || "",
        }))

      console.log("[OpenCodeAPI] Calling AI", {
        provider: providerName,
        model: modelName,
        messageCount: messages.length,
      })

      // Crear el provider apropiado
      let provider: any

      if (providerName === "openai" || providerName === "deepseek") {
        // DeepSeek es compatible con OpenAI SDK
        const baseURL = credential.baseUrl || (providerName === "deepseek"
          ? "https://api.deepseek.com"
          : undefined)

        provider = createOpenAI({
          apiKey: credential.apiKey,
          baseURL,
        })
      } else if (providerName === "anthropic") {
        provider = createAnthropic({
          apiKey: credential.apiKey,
        })
      } else {
        throw new Error(`Unsupported provider: ${providerName}`)
      }

      // Llamar a generateText
      const result = await generateText({
        model: provider(modelName),
        messages,
      })

      assistantContent = result.text
      promptTokens = result.usage?.promptTokens || 0
      completionTokens = result.usage?.completionTokens || 0

      console.log("[OpenCodeAPI] AI response received", {
        contentLength: assistantContent.length,
        promptTokens,
        completionTokens,
      })
    } catch (error: any) {
      console.error("[OpenCodeAPI] AI generation error:", error)
      // En caso de error, retornar un mensaje de error
      assistantContent = `Error al generar respuesta: ${error.message}`
    }

    // Guardar respuesta del asistente
    const assistantMessage = await sessionStore.addMessage(sessionId, tenantId, {
      role: "assistant",
      content: assistantContent,
      metadata: {
        model: options.model,
        tokens: {
          prompt: promptTokens,
          completion: completionTokens,
          total: promptTokens + completionTokens,
        },
      },
    })

    // Emitir evento de completado
    Bus.emit({
      type: "prompt.complete",
      sessionId,
      tenantId,
      messageId: assistantMessage.id,
      timestamp: Date.now(),
    })

    return {
      message: assistantMessage,
      sessionId,
      tokens: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
    }
  }

  /**
   * Get a session by ID
   */
  async getSession(
    sessionId: string,
    tenantId: string
  ): Promise<{
    id: string
    tenantId: string
    title: string | null
    directory: string | null
    isActive: boolean
    isArchived: boolean
    createdAt: Date
    updatedAt: Date
  } | null> {
    this.ensureInitialized()

    return sessionStore.getWithTenant(sessionId, tenantId)
  }

  /**
   * List sessions for a tenant
   */
  async listSessions(
    tenantId: string,
    options?: { limit?: number; includeArchived?: boolean }
  ): Promise<
    Array<{
      id: string
      tenantId: string
      title: string | null
      directory: string | null
      isActive: boolean
      isArchived: boolean
      createdAt: Date
      updatedAt: Date
      messageCount: number
    }>
  > {
    this.ensureInitialized()

    const sessions = await sessionStore.list(tenantId, {
      limit: options?.limit,
      includeArchived: options?.includeArchived,
    })

    // Obtener conteo de mensajes para cada sesión
    const sessionsWithCount = await Promise.all(
      sessions.map(async (session) => {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(agentMessages)
          .where(eq(agentMessages.sessionId, session.id))

        return {
          ...session,
          messageCount: result[0]?.count || 0,
        }
      })
    )

    return sessionsWithCount
  }

  /**
   * Archive a session
   */
  async archiveSession(
    sessionId: string,
    tenantId: string
  ): Promise<{ id: string; isArchived: boolean; archivedAt: Date | null } | null> {
    this.ensureInitialized()

    const session = await sessionStore.archive(sessionId, tenantId)
    if (!session) return null

    // Emitir evento
    Bus.emit({
      type: "session.archived",
      sessionId,
      tenantId,
      timestamp: Date.now(),
    })

    return {
      id: session.id,
      isArchived: session.isArchived,
      archivedAt: session.archivedAt,
    }
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<boolean> {
    this.ensureInitialized()

    try {
      await sessionStore.delete(sessionId, tenantId)

      // Emitir evento
      Bus.emit({
        type: "session.deleted",
        sessionId,
        tenantId,
        timestamp: Date.now(),
      })

      return true
    } catch (error) {
      console.error("[OpenCodeAPI] Error deleting session:", error)
      return false
    }
  }

  /**
   * Get messages for a session
   */
  async getSessionMessages(
    sessionId: string,
    tenantId: string,
    limit?: number
  ): Promise<
    Array<{
      id: string
      role: string
      content: string | null
      toolName: string | null
      toolCallId: string | null
      createdAt: Date
    }>
  > {
    this.ensureInitialized()

    // Verificar que la sesión pertenece al tenant
    const session = await sessionStore.getWithTenant(sessionId, tenantId)
    if (!session) {
      throw new Error("Session not found or access denied")
    }

    return sessionStore.getMessages(sessionId, { limit })
  }

  /**
   * Execute a prompt in a single step (creates session if needed)
   */
  async executeOneShot(
    tenantId: string,
    prompt: string,
    options: Omit<PromptOptions, "prompt"> & {
      sessionConfig?: Omit<TenantSessionConfig, "tenantId">
    } = {}
  ): Promise<PromptResult> {
    this.ensureInitialized()

    // Crear una nueva sesión
    const session = await this.createSession({
      tenantId,
      ...options.sessionConfig,
      title: options.sessionConfig?.title || prompt.slice(0, 50),
    })

    // Ejecutar el prompt
    return this.executePrompt(session.id, tenantId, {
      ...options,
      prompt,
    })
  }

  /**
   * Ensure the API is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error("OpenCode API not initialized. Call initialize() first.")
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    console.log("[OpenCodeAPI] Cleaning up")
    this.initialized = false
  }
}

/**
 * Global singleton instance of the OpenCode API
 */
export const opencode = new OpenCodeAPI()

/**
 * Utility function to initialize the API with default settings
 */
export async function initOpenCode(config?: OpenCodeConfig): Promise<OpenCodeAPI> {
  await opencode.initialize(config)
  return opencode
}
