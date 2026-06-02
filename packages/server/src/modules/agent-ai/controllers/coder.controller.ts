/**
 * Coder Controller
 *
 * Endpoints para el Agente Codificador:
 * - GET /coder - Info del codificador
 * - POST /coder/create-agent - Crear nuevo agente
 * - POST /coder/create-tool - Crear nueva tool
 * - GET /coder/agents - Listar agentes
 * - GET /coder/agents/:id - Obtener agente
 * - PATCH /coder/agents/:id - Actualizar agente
 * - DELETE /coder/agents/:id - Eliminar agente
 * - POST /coder/agents/:id/activate - Activar agente
 * - POST /coder/agents/:id/pause - Pausar agente
 */

import type { Context } from "hono"
import { agentCoderService, type CreateAgentInput, type CreateToolInput } from "../services"
import { toolRegistry } from "../services/tool-registry.service"
import { skillRegistry } from "../services/skill-registry.service"
import { db } from "@/db/connection"
import { tools } from "@/db/schema/tool"
import { skills } from "@/db/schema/skill"
import { eq } from "drizzle-orm"

// ============================================
// Coder Controller
// ============================================

export const coderController = {
  /**
   * GET /coder - Info del codificador
   */
  async getCoder(c: Context) {
    const tenantId = c.get("tenantId")

    try {
      const coder = await agentCoderService.getOrCreateCoder(tenantId)
      return c.json({
        success: true,
        data: coder,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error desconocido",
        },
        500
      )
    }
  },

  /**
   * POST /coder/create-agent - Crear nuevo agente
   */
  async createAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const body = await c.req.json()

    try {
      const input: CreateAgentInput = {
        tenantId,
        name: body.name,
        description: body.description,
        type: body.type || "EXTERNAL",
        systemPrompt: body.systemPrompt,
        instructions: body.instructions,
        role: body.role,
        style: body.style,
        language: body.language,
        allowedTools: body.allowedTools,
        blockedTools: body.blockedTools,
      }

      // Validaciones
      if (!input.name) {
        return c.json({ success: false, error: "El nombre es requerido" }, 400)
      }
      if (!["INTERNAL", "EXTERNAL"].includes(input.type)) {
        return c.json({ success: false, error: "Tipo debe ser INTERNAL o EXTERNAL" }, 400)
      }

      const agent = await agentCoderService.createAgent(input)

      return c.json({
        success: true,
        data: agent,
        message: `Agente "${agent.name}" creado exitosamente`,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al crear agente",
        },
        400
      )
    }
  },

  /**
   * POST /coder/create-tool - Crear nueva tool
   */
  async createTool(c: Context) {
    const tenantId = c.get("tenantId")
    const body = await c.req.json()

    try {
      const input: CreateToolInput = {
        tenantId,
        agentId: body.agentId,
        name: body.name,
        description: body.description,
        code: body.code,
        parameters: body.parameters || {},
        canExecuteCode: body.canExecuteCode,
      }

      // Validaciones
      if (!input.name) {
        return c.json({ success: false, error: "El nombre es requerido" }, 400)
      }
      if (!input.code) {
        return c.json({ success: false, error: "El código es requerido" }, 400)
      }

      const tool = await agentCoderService.createTool(input)

      return c.json({
        success: true,
        data: tool,
        message: `Tool "${tool.name}" creada exitosamente`,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al crear tool",
        },
        400
      )
    }
  },

  /**
   * GET /coder/agents - Listar agentes
   */
  async listAgents(c: Context) {
    const tenantId = c.get("tenantId")

    try {
      const agents = await agentCoderService.listAgents(tenantId)

      return c.json({
        success: true,
        data: agents,
        count: agents.length,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar agentes",
        },
        500
      )
    }
  },

  /**
   * GET /coder/agents/:id - Obtener agente
   */
  async getAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const agentId = c.req.param("id")

    try {
      const agent = await agentCoderService.getAgent(agentId, tenantId)

      if (!agent) {
        return c.json({ success: false, error: "Agente no encontrado" }, 404)
      }

      return c.json({
        success: true,
        data: agent,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al obtener agente",
        },
        500
      )
    }
  },

  /**
   * PATCH /coder/agents/:id - Actualizar agente
   */
  async updateAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const agentId = c.req.param("id")
    const body = await c.req.json()

    try {
      const agent = await agentCoderService.updateAgent(agentId, tenantId, body)

      return c.json({
        success: true,
        data: agent,
        message: "Agente actualizado exitosamente",
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al actualizar agente",
        },
        400
      )
    }
  },

  /**
   * DELETE /coder/agents/:id - Eliminar agente
   */
  async deleteAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const agentId = c.req.param("id")

    try {
      await agentCoderService.deleteAgent(agentId, tenantId)

      return c.json({
        success: true,
        message: "Agente eliminado exitosamente",
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al eliminar agente",
        },
        400
      )
    }
  },

  /**
   * POST /coder/agents/:id/activate - Activar agente
   */
  async activateAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const agentId = c.req.param("id")

    try {
      const agent = await agentCoderService.activateAgent(agentId, tenantId)

      return c.json({
        success: true,
        data: agent,
        message: `Agente "${agent.name}" activado`,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al activar agente",
        },
        400
      )
    }
  },

  /**
   * POST /coder/agents/:id/pause - Pausar agente
   */
  async pauseAgent(c: Context) {
    const tenantId = c.get("tenantId")
    const agentId = c.req.param("id")

    try {
      const agent = await agentCoderService.pauseAgent(agentId, tenantId)

      return c.json({
        success: true,
        data: agent,
        message: `Agente "${agent.name}" pausado`,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al pausar agente",
        },
        400
      )
    }
  },

  /**
   * GET /coder/tools - Listar tools
   */
  async listTools(c: Context) {
    const tenantId = c.get("tenantId")

    try {
      const allTools = await db.select().from(tools).where(eq(tools.tenantId, tenantId))

      // También incluir tools base
      const baseTools = toolRegistry.listBaseTools()

      return c.json({
        success: true,
        data: {
          base: baseTools,
          custom: allTools,
        },
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar tools",
        },
        500
      )
    }
  },

  /**
   * GET /coder/skills - Listar skills
   */
  async listSkills(c: Context) {
    const tenantId = c.get("tenantId")

    try {
      const allSkills = await db.select().from(skills).where(eq(skills.tenantId, tenantId))

      return c.json({
        success: true,
        data: allSkills,
      })
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Error al listar skills",
        },
        500
      )
    }
  },
}
