/**
 * WhatsApp Routes - Migrado a Hono
 */

import { Hono } from "hono"
import { authMiddleware } from "../../auth/middleware/auth.middleware"
import { whatsappConfigController } from "../controllers/whatsapp-config.controller"
import { evolutionWebhookController } from "../controllers/evolution-webhook.controller"
import { evolutionManagementController } from "../controllers/evolution-management.controller"

const whatsappRoutes = new Hono()

// Evolution API Webhook - NO requiere auth
whatsappRoutes.post("/evolution/webhook", (c) => evolutionWebhookController.handleWebhook(c))

whatsappRoutes.use("*", authMiddleware)

// Evolution API Management
whatsappRoutes.post("/evolution/create-instance", (c) => evolutionManagementController.createInstance(c))
whatsappRoutes.get("/evolution/qr/:instanceName", (c) => evolutionManagementController.getQRCode(c))
whatsappRoutes.get("/evolution/status/:instanceName", (c) => evolutionManagementController.getStatus(c))
whatsappRoutes.post("/evolution/disconnect/:instanceName", (c) => evolutionManagementController.disconnect(c))
whatsappRoutes.delete("/evolution/:instanceName", (c) => evolutionManagementController.deleteInstance(c))

// Endpoints para el frontend - devuelven array directo (sin wrapper)
whatsappRoutes.get("/agents", async (c) => {
  const tenantId = c.get("tenantId") as string
  const { whatsappConfigService } = await import("../services/whatsapp-config.service")
  const configs = await whatsappConfigService.list(tenantId, false)
  return c.json(configs)
})

whatsappRoutes.get("/conversations/active", (c) => c.json([]))

whatsappRoutes.patch("/agents/:agentId/toggle", async (c) => {
  const tenantId = c.get("tenantId") as string
  const agentId = c.req.param("agentId")
  const { db } = await import("../../../db")
  const { whatsappConfigs } = await import("../../../db/schema")
  const { eq, and } = await import("drizzle-orm")

  // Buscar config por agentId (columna agent_id), no por config ID
  const config = await db.query.whatsappConfigs.findFirst({
    where: and(eq(whatsappConfigs.agentId, agentId), eq(whatsappConfigs.tenantId, tenantId)),
  })
  if (!config) {
    return c.json({ error: "Config not found for this agent" }, 404)
  }
  const newStatus = !config.isActive
  const [updated] = await db
    .update(whatsappConfigs)
    .set({ isActive: newStatus, updatedAt: new Date() })
    .where(eq(whatsappConfigs.id, config.id))
    .returning()
  return c.json(updated)
})

// Endpoints usados por el frontend de detalle de agente
// GET /agents/:agentId - busca whatsapp_config por agentId
whatsappRoutes.get("/agents/:agentId", async (c) => {
  const tenantId = c.get("tenantId") as string
  const agentId = c.req.param("agentId")
  const { db } = await import("../../../db")
  const { whatsappConfigs, agents } = await import("../../../db/schema")
  const { eq, and } = await import("drizzle-orm")

  const config = await db.query.whatsappConfigs.findFirst({
    where: and(eq(whatsappConfigs.agentId, agentId), eq(whatsappConfigs.tenantId, tenantId)),
    with: { agent: true },
  })
  if (!config) {
    return c.json(null, 404)
  }
  // Flatten agent data into response for frontend compatibility
  const result = { ...config }
  if (!result.agentName && config.agent?.name) result.agentName = config.agent.name
  if (!result.agentRole && config.agent?.role) result.agentRole = config.agent.role
  if (!result.agentStyle && config.agent?.style) result.agentStyle = config.agent.style
  if (!result.agentInstructions && config.agent?.instructions) result.agentInstructions = config.agent.instructions
  return c.json(result)
})

// PUT /agents/:agentId - actualiza whatsapp_config por agentId
whatsappRoutes.put("/agents/:agentId", async (c) => {
  const tenantId = c.get("tenantId") as string
  const agentId = c.req.param("agentId")
  const body = await c.req.json()
  const { db } = await import("../../../db")
  const { whatsappConfigs } = await import("../../../db/schema")
  const { eq, and } = await import("drizzle-orm")

  const config = await db.query.whatsappConfigs.findFirst({
    where: and(eq(whatsappConfigs.agentId, agentId), eq(whatsappConfigs.tenantId, tenantId)),
  })
  if (!config) {
    return c.json({ error: "Config not found" }, 404)
  }
  const [updated] = await db
    .update(whatsappConfigs)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(whatsappConfigs.id, config.id))
    .returning()
  // Also update agent name if provided
  if (body.agentName && config.agentId) {
    try {
      const { agents } = await import("../../../db/schema")
      await db.update(agents).set({ name: body.agentName }).where(eq(agents.id, config.agentId))
    } catch {}
  }
  return c.json({ ...updated, agentName: body.agentName || updated.agentName })
})

// GET /agents/:agentId/conversations - lista conversaciones del agente
whatsappRoutes.get("/agents/:agentId/conversations", async (c) => {
  const tenantId = c.get("tenantId") as string
  const agentId = c.req.param("agentId")
  const { db } = await import("../../../db")
  const { whatsappConfigs, conversations } = await import("../../../db/schema")
  const { eq, and } = await import("drizzle-orm")

  const config = await db.query.whatsappConfigs.findFirst({
    where: and(eq(whatsappConfigs.agentId, agentId), eq(whatsappConfigs.tenantId, tenantId)),
  })
  if (!config) return c.json([])

  const convs = await db.query.conversations.findMany({
    where: eq(conversations.configId, config.id),
    orderBy: (conversations, { desc }) => [desc(conversations.updatedAt)],
    with: { messages: { limit: 1, orderBy: (messages, { desc }) => [desc(messages.createdAt)] } },
    limit: 50,
  })
  return c.json(convs || [])
})

// GET /agents/:agentId/stats - estadisticas del agente
whatsappRoutes.get("/agents/:agentId/stats", async (c) => {
  // TODO: implementar estadisticas reales
  return c.json({
    totalConversations: 0,
    totalMessages: 0,
    avgResponseTime: 0,
    activeConversations: 0,
    topQueries: [],
    dailyStats: [],
  })
})

// GET /conversations/:conversationId/messages - mensajes de una conversacion
whatsappRoutes.get("/conversations/:conversationId/messages", async (c) => {
  const conversationId = c.req.param("conversationId")
  const { db } = await import("../../../db")
  const { messages } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")

  const msgs = await db.query.messages.findMany({
    where: eq(messages.conversationId, conversationId),
    orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    limit: 100,
  })
  return c.json(msgs || [])
})




// Channel count for plan limit checking
whatsappRoutes.get("/channels/count", async (c) => {
  const tenantId = c.get("tenantId") as string
  const { db } = await import("../../../db")
  const { whatsappConfigs, tenants, plans } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")

  try {
    const configs = await db.query.whatsappConfigs.findMany({
      where: eq(whatsappConfigs.tenantId, tenantId),
    })

    let maxChannels = 1
    let planName = "Free"
    try {
      const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, tenantId) })
      if (tenant && tenant.planId) {
        const plan = await db.query.plans.findFirst({ where: eq(plans.id, tenant.planId) })
        if (plan && plan.limits) {
          maxChannels = (plan.limits as any).maxChannels || 1
          planName = plan.name
        }
      }
    } catch (e) {}

    return c.json({
      current: configs.length,
      max: maxChannels,
      planName,
      canCreateMore: configs.length < maxChannels,
    })
  } catch (error) {
    return c.json({ error: "Failed to get channel count" }, 500)
  }
})

// === AGENT CHAT (for internal agents and sandbox) ===
whatsappRoutes.post("/agents/:agentId/chat", async (c) => {
  const tenantId = c.get("tenantId") as string
  const agentId = c.req.param("agentId")
  const body = await c.req.json()
  const { message, history } = body

  if (!message) {
    return c.json({ error: "Message is required" }, 400)
  }

  const { db } = await import("../../../db")
  const { agents, tenants } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")
  const { aiService } = await import("../../../modules/ai/ai.service")

  try {
    // Find agent
    const agent = await db.query.agents.findFirst({
      where: (a: any, { and }: any) => and(eq(a.id, agentId), eq(a.tenantId, tenantId)),
    })

    if (!agent) {
      return c.json({ error: "Agent not found" }, 404)
    }

    // Load tenant masterPrompt
    let masterPrompt = ""
    try {
      const tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantId),
      })
      if (tenant && tenant.masterPrompt) {
        masterPrompt = tenant.masterPrompt
      }
    } catch (e) {}

    // Load knowledge base
    const { knowledgeEntries } = await import("../../../db/schema")
    let knowledgeContext = ""
    try {
      const entries = await db.query.knowledgeEntries.findMany({
        where: eq(knowledgeEntries.tenantId, tenantId),
        limit: 10,
      })
      if (entries.length > 0) {
        knowledgeContext = "\n\n--- BASE DE CONOCIMIENTO ---\n" +
          entries.map((e: any) => "[" + e.type + "] " + e.title + ": " + e.content).join("\n\n")
      }
    } catch (e) {}

    // Build system prompt
    const parts: string[] = []
    if (masterPrompt) {
      parts.push("=== REGLAS OBLIGATORIAS DEL SISTEMA ===\nEstas reglas son de cumplimiento OBLIGATORIO.\n" + masterPrompt + "\n=== FIN REGLAS OBLIGATORIAS ===")
    }
    parts.push(agent.role || "Sos un asistente de atencion al cliente.")
    if (agent.instructions) parts.push("Instrucciones: " + agent.instructions)
    if (agent.style) parts.push("Estilo: " + agent.style)
    if (agent.systemPrompt) parts.push("System prompt: " + agent.systemPrompt)
    if (knowledgeContext) parts.push(knowledgeContext)
    parts.push("REGLAS: Sos amable y profesional. Respondes en espanol. Si no sabes algo, decilo honestamente. Mantenes respuestas concisas.")

    const systemPrompt = parts.join("\n\n")

    // Build messages from history + current
    const messages = (history || []).concat([{ role: "user", content: message }])

    // Call AI
    const result = await aiService.processMessage({
      tenantId,
      agentId,
      messages,
      systemPrompt,
      temperature: 0.7,
    })

    // Build conversation history for response
    const conversationHistory = [
      ...(history || []),
      { role: "user", content: message },
      { role: "assistant", content: result.content },
    ]

    return c.json({
      response: result.content,
      conversationHistory,
      tokensUsed: result.tokensUsed,
    })
  } catch (error: any) {
    console.error("[Agent Chat] Error:", error.message)
    return c.json({ error: "Failed to process message" }, 500)
  }
})

// === MESSAGE FEEDBACK (for training) ===
whatsappRoutes.post("/messages/:messageId/feedback", async (c) => {
  const tenantId = c.get("tenantId") as string
  const messageId = c.req.param("messageId")
  const body = await c.req.json()
  const { feedback, note } = body

  if (!feedback || !["correct", "incorrect", "needs_improvement"].includes(feedback)) {
    return c.json({ error: "Feedback must be: correct, incorrect, or needs_improvement" }, 400)
  }

  const { db } = await import("../../../db")
  const { messages } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")

  try {
    const msg = await db.query.messages.findFirst({
      where: (m: any) => eq(m.id, messageId),
    })

    if (!msg) {
      return c.json({ error: "Message not found" }, 404)
    }

    // Update message metadata with feedback
    const existingMeta = (msg as any).metadata || {}
    const [updated] = await db
      .update(messages)
      .set({
        metadata: {
          ...existingMeta,
          feedback,
          feedbackNote: note || null,
          feedbackAt: new Date().toISOString(),
        },
      } as any)
      .where(eq(messages.id, messageId))
      .returning()

    return c.json({ ok: true, feedback, messageId })
  } catch (error: any) {
    return c.json({ error: "Failed to save feedback" }, 500)
  }
})

// === MASTER PROMPT (Admin only) ===
whatsappRoutes.get("/master-prompt", async (c) => {
  const tenantId = c.get("tenantId") as string
  const { db } = await import("../../../db")
  const { tenants } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
    })
    return c.json({
      masterPrompt: (tenant && tenant.masterPrompt) || "",
      tenantId,
    })
  } catch (error) {
    return c.json({ error: "Failed to load master prompt" }, 500)
  }
})

whatsappRoutes.put("/master-prompt", async (c) => {
  const tenantId = c.get("tenantId") as string
  const body = await c.req.json()
  const { db } = await import("../../../db")
  const { tenants } = await import("../../../db/schema")
  const { eq } = await import("drizzle-orm")
  try {
    const [updated] = await db
      .update(tenants)
      .set({
        masterPrompt: body.masterPrompt || null,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId))
      .returning()
    return c.json({
      ok: true,
      masterPrompt: (updated && updated.masterPrompt) || "",
    })
  } catch (error) {
    return c.json({ error: "Failed to update master prompt" }, 500)
  }
})

// CRUD basico (con wrapper success)
whatsappRoutes.post("/", (c) => whatsappConfigController.create(c))
whatsappRoutes.get("/", (c) => whatsappConfigController.list(c))
whatsappRoutes.get("/:id", (c) => whatsappConfigController.getById(c))
whatsappRoutes.put("/:id", (c) => whatsappConfigController.update(c))
whatsappRoutes.delete("/:id", (c) => whatsappConfigController.delete(c))

// Acciones especiales
whatsappRoutes.post("/:id/link-agent", (c) => whatsappConfigController.linkToAgent(c))
whatsappRoutes.delete("/:id/unlink-agent", (c) => whatsappConfigController.unlinkFromAgent(c))
whatsappRoutes.post("/:id/test", (c) => whatsappConfigController.testConnection(c))

export { whatsappRoutes }
