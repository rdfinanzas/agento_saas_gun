/**
 * Chat Routes - SP-7
 * 
 * API endpoints para chat con el agente codificador
 * 
 * Endpoints:
 * - POST   /api/v1/ai/execute      - Ejecutar prompt
 * - GET    /api/v1/ai/sessions     - Listar sesiones
 * - POST   /api/v1/ai/sessions     - Crear sesión
 * - GET    /api/v1/ai/sessions/:id - Obtener sesión con mensajes
 * - DELETE /api/v1/ai/sessions/:id - Eliminar sesión
 * - GET    /api/v1/ai/stream       - SSE streaming
 */

import { Hono } from "hono"
import { streamSSE } from "hono/streaming"
import { sessionStore, Bus } from "@/lib/opencode/api-pg"
import { opencode } from "@/lib/opencode/api"
import { db } from "@/db"
import { agentSessions, agentMessages } from "@/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { z } from "zod"

export const chatRoutes = new Hono()

// Schemas de validación
const executeSchema = z.object({
  prompt: z.string().min(1).max(10000),
  sessionId: z.string().uuid().optional(),
  model: z.string().optional(),
  system: z.string().optional(),
})

const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
  agentId: z.string().uuid().optional(),
})

// POST /api/v1/ai/execute - Ejecutar prompt
chatRoutes.post("/execute", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const body = await c.req.json()

  const result = executeSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  const { prompt, sessionId, model, system } = result.data

  try {
    // Obtener o crear sesión
    let session
    if (sessionId) {
      session = await sessionStore.getWithTenant(sessionId, tenantId)
      if (!session) {
        return c.json({ error: "Session not found" }, 404)
      }
    } else {
      session = await sessionStore.create({
        tenantId,
        userId,
        title: prompt.slice(0, 50) + (prompt.length > 50 ? "..." : ""),
      })
    }

    // Ejecutar prompt
    const executionResult = await opencode.executePrompt(
      session.id,
      tenantId,
      {
        prompt,
        model,
        system,
      }
    )

    return c.json({
      success: true,
      sessionId: session.id,
      message: executionResult.message,
      tokens: executionResult.tokens,
    })
  } catch (error) {
    console.error("[Chat] Execute error:", error)
    return c.json({
      error: "Execution failed",
      message: error instanceof Error ? error.message : "Unknown error",
    }, 500)
  }
})

// GET /api/v1/ai/sessions - Listar sesiones
chatRoutes.get("/sessions", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const limit = parseInt(c.req.query("limit") || "20")
  const includeArchived = c.req.query("archived") === "true"

  try {
    const sessions = await sessionStore.list(tenantId, {
      limit,
      includeArchived,
      userId,
    })

    // Obtener conteo de mensajes para cada sesión
    const sessionsWithMessages = await Promise.all(
      sessions.map(async (session) => {
        const messageCount = await db
          .select({ count: db.fn.count() })
          .from(agentMessages)
          .where(eq(agentMessages.sessionId, session.id))
          .then(r => Number(r[0]?.count || 0))

        return {
          ...session,
          messageCount,
        }
      })
    )

    return c.json({ sessions: sessionsWithMessages })
  } catch (error) {
    console.error("[Chat] List sessions error:", error)
    return c.json({ error: "Failed to list sessions" }, 500)
  }
})

// POST /api/v1/ai/sessions - Crear nueva sesión
chatRoutes.post("/sessions", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const body = await c.req.json()

  const result = createSessionSchema.safeParse(body)
  if (!result.success) {
    return c.json({ error: "Invalid input", details: result.error.issues }, 400)
  }

  try {
    const session = await sessionStore.create({
      tenantId,
      userId,
      agentId: result.data.agentId,
      title: result.data.title || "Nueva conversación",
    })

    return c.json({ session }, 201)
  } catch (error) {
    console.error("[Chat] Create session error:", error)
    return c.json({ error: "Failed to create session" }, 500)
  }
})

// GET /api/v1/ai/sessions/:id - Obtener sesión con mensajes
chatRoutes.get("/sessions/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")
  const limit = parseInt(c.req.query("limit") || "50")

  try {
    const session = await sessionStore.getWithTenant(id, tenantId)
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }

    const messages = await sessionStore.getMessages(id, { limit })

    return c.json({
      session,
      messages,
    })
  } catch (error) {
    console.error("[Chat] Get session error:", error)
    return c.json({ error: "Failed to get session" }, 500)
  }
})

// DELETE /api/v1/ai/sessions/:id - Eliminar sesión
chatRoutes.delete("/sessions/:id", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  try {
    const success = await sessionStore.delete(id, tenantId)
    if (!success) {
      return c.json({ error: "Session not found" }, 404)
    }

    return c.json({ success: true })
  } catch (error) {
    console.error("[Chat] Delete session error:", error)
    return c.json({ error: "Failed to delete session" }, 500)
  }
})

// POST /api/v1/ai/sessions/:id/archive - Archivar sesión
chatRoutes.post("/sessions/:id/archive", async (c) => {
  const tenantId = c.get("tenantId")
  const id = c.req.param("id")

  try {
    const session = await sessionStore.archive(id, tenantId)
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }

    return c.json({ session })
  } catch (error) {
    console.error("[Chat] Archive session error:", error)
    return c.json({ error: "Failed to archive session" }, 500)
  }
})

// GET /api/v1/ai/stream - SSE Streaming
chatRoutes.get("/stream", async (c) => {
  const sessionId = c.req.query("sessionId")
  const tenantId = c.get("tenantId")

  // Si hay sessionId, verificar que pertenece al tenant
  if (sessionId) {
    const session = await sessionStore.getWithTenant(sessionId, tenantId)
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }
  }

  return streamSSE(c, async (stream) => {
    // Enviar evento de conexión
    await stream.writeSSE({
      data: JSON.stringify({
        type: "connected",
        timestamp: Date.now(),
        sessionId,
      }),
    })

    // Suscribirse a eventos
    const unsubscribe = Bus.subscribeAll(async (event: any) => {
      // Filtrar por tenant
      if (event.tenantId && event.tenantId !== tenantId) {
        return
      }

      // Filtrar por sessionId si se especificó
      if (sessionId && event.sessionId && event.sessionId !== sessionId) {
        return
      }

      await stream.writeSSE({
        data: JSON.stringify(event),
      })
    })

    // Heartbeat cada 30 segundos
    const heartbeat = setInterval(async () => {
      await stream.writeSSE({
        data: JSON.stringify({
          type: "heartbeat",
          timestamp: Date.now(),
        }),
      })
    }, 30000)

    // Cleanup al cerrar
    c.req.raw.signal.addEventListener("abort", () => {
      unsubscribe()
      clearInterval(heartbeat)
    })

    // Mantener conexión abierta
    while (!c.req.raw.signal.aborted) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  })
})

// POST /api/v1/ai/sessions/:id/messages - Enviar mensaje (para streaming)
chatRoutes.post("/sessions/:id/messages", async (c) => {
  const tenantId = c.get("tenantId")
  const userId = c.get("userId")
  const id = c.req.param("id")
  const body = await c.req.json()

  const { content } = body
  if (!content || typeof content !== "string") {
    return c.json({ error: "Content is required" }, 400)
  }

  try {
    // Verificar sesión
    const session = await sessionStore.getWithTenant(id, tenantId)
    if (!session) {
      return c.json({ error: "Session not found" }, 404)
    }

    // Guardar mensaje del usuario
    const userMessage = await sessionStore.addMessage(id, tenantId, {
      role: "user",
      content,
    })

    // Emitir evento
    Bus.emit({
      type: "message.user",
      sessionId: id,
      tenantId,
      message: userMessage,
      timestamp: Date.now(),
    })

    // Iniciar procesamiento async (no esperamos respuesta)
    opencode.executePrompt(id, tenantId, { prompt: content }).then(result => {
      Bus.emit({
        type: "message.assistant",
        sessionId: id,
        tenantId,
        message: result.message,
        timestamp: Date.now(),
      })
    }).catch(error => {
      Bus.emit({
        type: "message.error",
        sessionId: id,
        tenantId,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now(),
      })
    })

    return c.json({
      success: true,
      message: userMessage,
    })
  } catch (error) {
    console.error("[Chat] Send message error:", error)
    return c.json({ error: "Failed to send message" }, 500)
  }
})
