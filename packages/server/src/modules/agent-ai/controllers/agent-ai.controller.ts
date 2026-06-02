/**
 * Agent AI Controller
 * Controlador para ejecutar el agente AI
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { agentAiService } from "../services/agent-ai.service"

export class AgentAiController {
  /**
   * GET /api/v1/ai/health
   * Verifica si el servicio esta disponible
   */
  async healthCheck(c: Context) {
    const health = await agentAiService.healthCheck()
    return c.json(health)
  }

  /**
   * POST /api/v1/ai/execute
   * Ejecuta una tarea con el agente AI
   */
  async execute(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const body = await c.req.json()

      const { prompt, sessionId } = body

      if (!prompt) {
        throw new HTTPException(400, { message: "Prompt is required" })
      }

      const result = await agentAiService.execute(prompt, tenantId, sessionId)

      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      console.error("Agent AI execute error:", error)
      throw new HTTPException(500, { message: "Agent AI execution failed" })
    }
  }

  /**
   * POST /api/v1/ai/execute/stream
   * Ejecuta una tarea con streaming de eventos SSE
   */
  async executeStream(c: Context) {
    try {
      const tenantId = c.get("tenantId") as string
      const body = await c.req.json()

      const { prompt, sessionId } = body

      if (!prompt) {
        throw new HTTPException(400, { message: "Prompt is required" })
      }

      // Por ahora ejecutamos sin stream, luego podemos implementar streaming real
      const result = await agentAiService.execute(prompt, tenantId, sessionId)

      return c.json(result)
    } catch (error) {
      if (error instanceof HTTPException) throw error
      console.error("Agent AI stream error:", error)
      throw new HTTPException(500, { message: "Agent AI streaming failed" })
    }
  }

  /**
   * GET /api/v1/ai/sessions
   * Lista las sesiones del tenant
   */
  async listSessions(c: Context) {
    const tenantId = c.get("tenantId") as string
    const sessions = await agentAiService.listSessions(tenantId)
    return c.json({ sessions })
  }

  /**
   * GET /api/v1/ai/sessions/:id
   * Obtiene una sesion por ID
   */
  async getSession(c: Context) {
    const tenantId = c.get("tenantId") as string
    const sessionId = c.req.param("id")

    if (!sessionId) {
      throw new HTTPException(400, { message: "Session ID is required" })
    }

    const session = await agentAiService.getSession(tenantId, sessionId)

    if (!session) {
      throw new HTTPException(404, { message: "Session not found" })
    }

    return c.json(session)
  }

  /**
   * DELETE /api/v1/ai/sessions/:id
   * Elimina una sesion
   */
  async deleteSession(c: Context) {
    const tenantId = c.get("tenantId") as string
    const sessionId = c.req.param("id")

    if (!sessionId) {
      throw new HTTPException(400, { message: "Session ID is required" })
    }

    const deleted = await agentAiService.deleteSession(tenantId, sessionId)

    if (!deleted) {
      throw new HTTPException(404, { message: "Session not found" })
    }

    return c.json({ success: true })
  }

  /**
   * GET /api/v1/ai/stats
   * Estadisticas del agente AI
   */
  async getStats(c: Context) {
    const tenantId = c.get("tenantId") as string
    const stats = await agentAiService.getStats(tenantId)
    return c.json(stats)
  }
}

export const agentAiController = new AgentAiController()
