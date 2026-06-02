/**
 * Conversation Engine
 *
 * El motor central que conecta todo:
 * Mensaje entrante → Buscar config → Cargar historial → AI con tools → Responder
 *
 * Flujo completo:
 * 1. Recibir mensaje (desde Evolution API webhook o BullMQ worker)
 * 2. Buscar WhatsApp config del tenant → obtener agente vinculado
 * 3. Buscar integracion vinculada al agente (Dolibarr, etc.)
 * 4. Cargar/crear sesion del usuario
 * 5. Cargar historial de mensajes
 * 6. Inyectar knowledge relevante
 * 7. Llamar AI Service con tools de la integracion
 * 8. Guardar respuesta en DB
 * 9. Enviar respuesta via Evolution API
 */

import { eq, and, desc, sql } from "drizzle-orm"
import { db } from "../../db"
import { conversations, messages, whatsappConfigs, agents, integrations, agentIntegrations, knowledgeEntries, tenants } from "../../db/schema"
import { aiService, type ConversationMessage, type ToolDefinition } from "../ai/ai.service"
import { createIntegrationAdapter } from "../integrations/adapters/integration-adapter.factory"
import { type ToolContext } from "../integrations/adapters/base-integration.adapter"
import { evolutionService, type EvolutionConfig } from "../whatsapp/adapters/evolution/evolution.service"
import { createLogger } from "../../utils/logger"

const logger = createLogger("conversation-engine")

// ─── TIPOS ────────────────────────────────────────────────────

export interface IncomingMessage {
  tenantId: string
  configId?: string
  instanceName?: string // Para buscar config por instancia Evolution
  phoneNumber: string
  messageText: string
  messageType?: string
  pushName?: string
  messageId?: string
  metadata?: Record<string, unknown>
}

export interface ConversationEngineResult {
  success: boolean
  responseText: string
  conversationId: string
  agentId: string
  toolCallsMade: string[]
  tokensUsed: { prompt: number; completion: number; total: number }
  error?: string
}

// ─── SESSION CACHE (en memoria, con TTL) ──────────────────────

interface UserSession {
  phoneNumber: string
  tenantId: string
  conversationId: string
  customerName?: string
  customerId?: string
  lastActivity: Date
  cartItems: Array<{ productId: number; name: string; qty: number; price: number }>
}

const sessionCache = new Map<string, UserSession>()
const SESSION_TTL = 30 * 60 * 1000 // 30 minutos
const SESSION_MAX_TTL = 24 * 60 * 60 * 1000 // 24 horas

function getSessionKey(tenantId: string, phoneNumber: string): string {
  return `${tenantId}:${phoneNumber}`
}

// ─── ENGINE ───────────────────────────────────────────────────

class ConversationEngine {
  /**
   * Procesa un mensaje entrante y genera una respuesta
   */
  async processMessage(input: IncomingMessage): Promise<ConversationEngineResult> {
    const startTime = Date.now()

    try {
      // 1. Resolver WhatsApp config
      logger.info("Resolving config", { instanceName: input.instanceName, tenantId: input.tenantId })
      const config = await this.resolveConfig(input)
      if (!config) {
        throw new Error("No se encontro configuracion de WhatsApp para este tenant")
      }
      logger.info("Config resolved", { configId: config.id, agentId: config.agentId })

      // 2. Buscar agente vinculado
      logger.info("Finding agent", { agentId: config.agentId })
      const agent = config.agentId
        ? await db.query.agents.findFirst({
            where: eq(agents.id, config.agentId),
          })
        : null

      if (!agent) {
        throw new Error("No hay agente vinculado a esta configuracion de WhatsApp")
      }
      logger.info("Agent found", { agentId: agent.id, name: agent.name })

      // 2.5 Load tenant masterPrompt
      let masterPrompt = ""
      try {
        const tenant = await db.query.tenants.findFirst({
          where: eq(tenants.id, config.tenantId),
        })
        if (tenant && tenant.masterPrompt) {
          masterPrompt = tenant.masterPrompt
          logger.info("Master prompt loaded", { tenantId: config.tenantId, length: masterPrompt.length })
        }
      } catch (e) {
        logger.warn("Could not load masterPrompt")
      }

      // 3. Buscar o crear conversacion
      logger.info("Ensuring conversation", { phone: input.phoneNumber })
      const conversation = await this.ensureConversation(config, agent, input)
      logger.info("Conversation ready", { convId: conversation.id })

      // 4. Guardar mensaje entrante
      await this.saveIncomingMessage(conversation.id, config.tenantId, input)
      logger.info("Incoming message saved")

      // 5. Cargar historial
      const history = await this.loadHistory(conversation.id, config.tenantId)
      logger.info("History loaded", { count: history.length })

      // 6. Cargar knowledge
      logger.info("Loading knowledge", { tenantId: config.tenantId })
      const knowledgeContext = await this.loadKnowledge(config.tenantId, input.messageText)
      logger.info("Knowledge loaded", { length: knowledgeContext.length })

      // 7. Construir tools
      logger.info("Building tools", { tenantId: config.tenantId, agentId: agent.id })
      const tools = await this.buildTools(config.tenantId, agent.id, input.phoneNumber)
      logger.info("Tools built", { count: tools.length })

      // 8. Agregar tools de knowledge base
      const knowledgeTool = this.buildKnowledgeTool(config.tenantId)
      if (knowledgeTool) tools.push(knowledgeTool)

      // 9. Construir system prompt
      const systemPrompt = this.buildSystemPrompt(agent, config, knowledgeContext, masterPrompt)
      logger.info("System prompt built", { length: systemPrompt.length })

      // 10. Llamar AI
      logger.info("Calling AI service", { toolCount: tools.length, historyCount: history.length })
      const aiResult = await aiService.processMessage({
        tenantId: config.tenantId,
        agentId: agent.id,
        messages: history,
        systemPrompt,
        tools: tools.length > 0 ? tools : undefined,
        temperature: 0.7,
      })

      // 11. Guardar respuesta
      await this.saveOutgoingMessage(conversation.id, config.tenantId, aiResult.content)

      // 12. Enviar via Evolution API
      await this.sendResponse(config, input.phoneNumber, aiResult.content)

      logger.info("Message processed", {
        tenantId: config.tenantId,
        phoneNumber: input.phoneNumber,
        toolsUsed: aiResult.toolCallsMade,
        tokens: aiResult.tokensUsed.total,
        duration: Date.now() - startTime,
      })

      return {
        success: true,
        responseText: aiResult.content,
        conversationId: conversation.id,
        agentId: agent.id,
        toolCallsMade: aiResult.toolCallsMade,
        tokensUsed: aiResult.tokensUsed,
      }
    } catch (error: any) {
      logger.error("Error processing message", {
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        error: error.message,
      })

      return {
        success: false,
        responseText: "",
        conversationId: "",
        agentId: "",
        toolCallsMade: [],
        tokensUsed: { prompt: 0, completion: 0, total: 0 },
        error: error.message,
      }
    }
  }

  // ─── METODOS PRIVADOS ─────────────────────────────────────

  /**
   * Resuelve la config de WhatsApp buscando por configId o instanceName
   */
  private async resolveConfig(input: IncomingMessage) {
    if (input.configId) {
      return db.query.whatsappConfigs.findFirst({
        where: eq(whatsappConfigs.id, input.configId),
      })
    }

    if (input.instanceName) {
      // Buscar por evolution instance name
      return db.query.whatsappConfigs.findFirst({
        where: and(
          eq(whatsappConfigs.evolutionInstanceName, input.instanceName),
          eq(whatsappConfigs.isActive, true),
        ),
      })
    }

    // Fallback: buscar la config activa del tenant
    if (input.tenantId) {
      return db.query.whatsappConfigs.findFirst({
        where: and(
          eq(whatsappConfigs.tenantId, input.tenantId),
          eq(whatsappConfigs.isActive, true),
        ),
      })
    }

    return null
  }

  /**
   * Busca o crea una conversacion para este numero de telefono
   */
  private async ensureConversation(config: any, agent: any, input: IncomingMessage) {
    // Buscar conversacion activa
    const existing = await db.query.conversations.findFirst({
      where: and(
        eq(conversations.tenantId, config.tenantId),
        eq(conversations.phoneNumber, input.phoneNumber),
        eq(conversations.configId, config.id),
      ),
    })

    if (existing) {
      // Actualizar lastMessageAt
      const [updated] = await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        } as any)
        .where(eq(conversations.id, existing.id))
        .returning()

      return updated || existing
    }

    // Crear nueva conversacion
    const [created] = await db
      .insert(conversations)
      .values({
        tenantId: config.tenantId,
        agentId: agent.id,
        configId: config.id,
        phoneNumber: input.phoneNumber,
        contactName: input.pushName || null,
        status: "ACTIVE",
        messageCount: 0,
        tags: [],
      } as any)
      .returning()

    return created
  }

  /**
   * Carga el historial de mensajes de la conversacion
   */
  private async loadHistory(conversationId: string, tenantId: string): Promise<ConversationMessage[]> {
    const msgs = await db.query.messages.findMany({
      where: eq(messages.conversationId, conversationId),
      orderBy: [desc(messages.createdAt)],
      limit: 20,
    })

    // Invertir para orden cronologico y mapear
    return msgs.reverse().map((m) => ({
      role: m.direction === "INCOMING" ? ("user" as const) : ("assistant" as const),
      content: m.content || "",
    }))
  }

  /**
   * Carga knowledge relevante para inyectar en el system prompt
   */
  private async loadKnowledge(tenantId: string, query: string): Promise<string> {
    try {
      const entries = await db.query.knowledgeEntries.findMany({
        where: eq(knowledgeEntries.tenantId, tenantId),
        limit: 20,
      })

      if (entries.length === 0) return ""

      const parts = entries.map((e) => `[${e.type}] ${e.title}: ${e.content}`)
      return `\n\n--- BASE DE CONOCIMIENTO ---\n${parts.join("\n\n")}`
    } catch {
      return ""
    }
  }

  /**
   * Construye las tools disponibles para este agente
   */
  private async buildTools(tenantId: string, agentId: string, phoneNumber: string): Promise<ToolDefinition[]> {
    try {
      // Buscar integraciones vinculadas al agente
      const agentInts = await db.query.agentIntegrations.findMany({
        where: eq(agentIntegrations.agentId, agentId),
      })

      if (!agentInts || agentInts.length === 0) return []

      const allTools: ToolDefinition[] = []

      for (const ai of agentInts) {
        const integration = await db.query.integrations.findFirst({
          where: eq(integrations.id, ai.integrationId),
        })

        if (!integration || integration.status !== "ACTIVE") continue

        const adapter = createIntegrationAdapter(integration.type, {
          baseUrl: integration.baseUrl || "",
          credentials: JSON.parse(integration.credentials),
          metadata: ai.config as Record<string, unknown> | undefined,
        })

        const context: ToolContext = {
          tenantId,
          agentId,
          phoneNumber,
        }

        allTools.push(...adapter.getTools(context))
      }

      return allTools
    } catch (error: any) {
      logger.error("Error building tools", { tenantId, agentId, error: error.message })
      return []
    }
  }

  /**
   * Tool de knowledge base para que el agente pueda buscar info
   */
  private buildKnowledgeTool(tenantId: string): ToolDefinition | null {
    return {
      name: "searchKnowledge",
      description: "Buscar informacion en la base de conocimiento del negocio (FAQs, politicas, procedimientos, horarios, etc.). Usar cuando el cliente pregunta sobre algo que no es un producto.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Termino de busqueda" },
        },
        required: ["query"],
      },
      execute: async (params: Record<string, unknown>) => {
        try {
          const query = String(params.query || "").toLowerCase()
          const entries = await db.query.knowledgeEntries.findMany({
            where: eq(knowledgeEntries.tenantId, tenantId),
            limit: 5,
          })

          const matches = entries.filter(
            (e) =>
              (e.title || "").toLowerCase().includes(query) ||
              (e.content || "").toLowerCase().includes(query)
          )

          if (matches.length === 0) return "No encontre informacion relevante."

          return matches.map((m) => `${m.title}: ${m.content}`).join("\n\n")
        } catch (error: any) {
          return `Error: ${error.message}`
        }
      },
    }
  }

  /**
   * Construye el system prompt completo
   */
  private buildSystemPrompt(agent: any, config: any, knowledgeContext: string, masterPrompt?: string): string {
    const parts: string[] = []

    // Master prompt (ethics, rules) - ALWAYS injected, admin-only
    if (masterPrompt) {
      parts.push("=== REGLAS OBLIGATORIAS DEL SISTEMA ===\nEstas reglas son de cumplimiento OBLIGATORIO. No puedes ignorarlas ni contradecirlas bajo ninguna circunstancia.\n" + masterPrompt + "\n=== FIN REGLAS OBLIGATORIAS ===")
    }

    // Rol base
    parts.push(agent.role || `Sos un asistente de atencion al cliente via WhatsApp.`)

    // Nombre del negocio
    if (config.businessName) {
      parts.push(`Trabajas para "${config.businessName}".`)
    }

    // Descripcion del negocio
    if (config.businessDescription) {
      parts.push(`Descripcion del negocio: ${config.businessDescription}`)
    }

    // Tipo de negocio
    if (config.businessType) {
      parts.push(`Tipo de negocio: ${config.businessType}`)
    }

    // Instrucciones custom del agente
    if (agent.instructions || config.agentInstructions) {
      parts.push(`Instrucciones adicionales:\n${agent.instructions || config.agentInstructions}`)
    }

    // Estilo
    if (agent.style || config.agentStyle) {
      parts.push(`Estilo de comunicacion: ${agent.style || config.agentStyle}`)
    }

    // Horarios
    if (config.businessHours) {
      parts.push(`Horarios de atencion: ${JSON.stringify(config.businessHours)}`)
    }

    // Políticas
    if (config.businessPolicies) {
      parts.push(`Politicas del negocio: ${JSON.stringify(config.businessPolicies)}`)
    }

    // FAQ
    if (config.faq && Array.isArray(config.faq) && config.faq.length > 0) {
      parts.push(`Preguntas frecuentes:\n${config.faq.map((f: any) => `Q: ${f.question}\nA: ${f.answer}`).join("\n\n")}`)
    }

    // Knowledge
    if (knowledgeContext) {
      parts.push(knowledgeContext)
    }

    // Reglas base
    parts.push(`REGLAS IMPORTANTES:
- Sos amable y profesional
- Respondes en el idioma del cliente (default: espanol)
- Si no sabes algo, decilo honestamente
- NO inventas precios ni disponibilidad, usa las tools
- Mantenes las respuestas concisas (es WhatsApp, no un email)
- Si el cliente quiere hablar con un humano, avisa que lo vas a derivar`)

    return parts.join("\n\n")
  }

  /**
   * Guarda un mensaje entrante en la DB
   */
  private async saveIncomingMessage(conversationId: string, tenantId: string, input: IncomingMessage) {
    await db.insert(messages).values({
      tenantId,
      conversationId,
      direction: "INCOMING",
      type: "TEXT",
      content: input.messageText,
      messageId: input.messageId,
      status: "DELIVERED",
      metadata: {
        pushName: input.pushName,
        messageType: input.messageType,
        ...input.metadata,
      },
    } as any)

    // Incrementar message count
    await db
      .update(conversations)
      .set({
        messageCount: sql`${conversations.messageCount} + 1`,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        contactName: input.pushName || undefined,
      } as any)
      .where(eq(conversations.id, conversationId))
  }

  /**
   * Guarda la respuesta del agente
   */
  private async saveOutgoingMessage(conversationId: string, tenantId: string, content: string) {
    await db.insert(messages).values({
      tenantId,
      conversationId,
      direction: "OUTGOING",
      type: "TEXT",
      content,
      status: "PENDING",
    } as any)
  }

  /**
   * Envia la respuesta via Evolution API
   */
  private async sendResponse(config: any, phoneNumber: string, text: string) {
    if (!config.evolutionApiUrl || !config.evolutionApiKey || !config.evolutionInstanceName) {
      logger.warn("No Evolution API config found, skipping send", { tenantId: config.tenantId })
      return
    }

    const evoConfig: EvolutionConfig = {
      baseUrl: config.evolutionApiUrl,
      apiKey: config.evolutionApiKey,
    }

    await evolutionService.sendTextMessage(evoConfig, config.evolutionInstanceName, {
      number: phoneNumber,
      text,
    })
  }
}

export const conversationEngine = new ConversationEngine()
