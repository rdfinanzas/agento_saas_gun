/**
 * Agents Controller - Migrado a Hono
 */

import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { eq } from "drizzle-orm"
import { db } from "../../../db"
import { agentTemplates, agentTemplateInstallations, knowledgeEntries } from "../../../db/schema"
import { agentsService, type CreateAgentInput, type UpdateAgentInput } from "../services/agents.service"
import { createLogger } from "../../../utils/logger"

const logger = createLogger("agents-controller")

export class AgentsController {
  /**
   * POST /api/v1/agents
   * Crea un nuevo agente
   */
  async create(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()

    const agent = await agentsService.create({
      tenantId,
      ...body,
    })

    return c.json({
      success: true,
      data: agent,
    })
  }

  /**
   * GET /api/v1/agents
   * Lista agentes con filtros
   */
  async list(c: Context) {
    const tenantId = c.get("tenantId") as string
    const type = c.req.query("type") as string | undefined
    const status = c.req.query("status") as string | undefined
    const search = c.req.query("search")
    const page = parseInt(c.req.query("page") || "1")
    const limit = parseInt(c.req.query("limit") || "20")

    const result = await agentsService.list({
      tenantId,
      type: type as any,
      status: status as any,
      search,
      page,
      limit,
    })

    return c.json({
      success: true,
      data: result.agents,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    })
  }

  /**
   * GET /api/v1/agents/:id
   * Obtiene un agente por ID
   */
  async getById(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const includeRelations = c.req.query("includeRelations") === "true"

    const agent = await agentsService.getById(id, tenantId, includeRelations)

    if (!agent) {
      throw new HTTPException(404, { message: "Agent not found" })
    }

    return c.json({
      success: true,
      data: agent,
    })
  }

  /**
   * PUT /api/v1/agents/:id
   * Actualiza un agente
   */
  async update(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    const agent = await agentsService.update(id, tenantId, body)

    return c.json({
      success: true,
      data: agent,
    })
  }

  /**
   * DELETE /api/v1/agents/:id
   * Elimina un agente (soft delete)
   */
  async delete(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")

    await agentsService.delete(id, tenantId)

    return c.json({
      success: true,
      message: "Agent deleted successfully",
    })
  }

  /**
   * PATCH /api/v1/agents/:id/status
   * Cambia el estado de un agente
   */
  async setStatus(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json()

    if (!body.status) {
      throw new HTTPException(400, { message: "status is required" })
    }

    const agent = await agentsService.setStatus(id, tenantId, body.status)

    return c.json({
      success: true,
      data: agent,
    })
  }

  /**
   * POST /api/v1/agents/:id/duplicate
   * Duplica un agente
   */
  async duplicate(c: Context) {
    const tenantId = c.get("tenantId") as string
    const id = c.req.param("id")
    const body = await c.req.json().catch(() => ({}))

    const agent = await agentsService.duplicate(id, tenantId, body.name)

    return c.json({
      success: true,
      data: agent,
    })
  }

  /**
   * GET /api/v1/agents/type/:type
   * Obtiene agentes por tipo
   */
  async getByType(c: Context) {
    const tenantId = c.get("tenantId") as string
    const type = c.req.param("type") as string
    const activeOnly = c.req.query("activeOnly") !== "false"

    const agents = await agentsService.getByType(tenantId, type as any, activeOnly)

    return c.json({
      success: true,
      data: agents,
    })
  }

  /**
   * GET /api/v1/agents/hierarchy
   * Obtiene el árbol jerárquico de agentes
   */
  async getHierarchy(c: Context) {
    const tenantId = c.get("tenantId") as string

    const hierarchy = await agentsService.getHierarchy(tenantId)

    return c.json({
      success: true,
      data: hierarchy,
    })
  }

  /**
   * GET /api/v1/agents/stats
   * Obtiene estadísticas de agentes
   */
  async getStats(c: Context) {
    const tenantId = c.get("tenantId") as string

    const stats = await agentsService.getStats(tenantId)

    return c.json({
      success: true,
      data: stats,
    })
  }

  /**
   * POST /api/v1/agents/templates/deploy
   * Crea un agente + knowledge base a partir de un template
   */
  /**
   * GET /api/v1/agents/templates
   * Lista templates de agentes disponibles
   */
  async listTemplates(c: Context) {
    try {
      const category = c.req.query("category")
      let result = await db.select().from(agentTemplates).where(eq(agentTemplates.isActive, true))
      if (category) {
        result = result.filter(t => t.config && typeof t.config === "object" && (t.config as any).category === category)
      }
      return c.json({ success: true, data: result })
    } catch (error) {
      logger.error("listTemplates error", { error: error instanceof Error ? error.message : String(error) })
      throw new HTTPException(500, { message: "Failed to list templates" })
    }
  }

  async deployTemplate(c: Context) {
    const tenantId = c.get("tenantId") as string
    const body = await c.req.json()
    const { templateId, variables } = body

    if (!templateId) {
      throw new HTTPException(400, { message: "templateId is required" })
    }

    try {
      // 1. Buscar template
      const template = await db.query.agentTemplates.findFirst({
        where: eq(agentTemplates.id, templateId),
      })

      if (!template) {
        throw new HTTPException(404, { message: "Template not found" })
      }

      const config = template.config as any
      let systemPrompt = config.systemPrompt || ""

      // 2. Reemplazar variables en el system prompt
      if (variables) {
        for (const [key, value] of Object.entries(variables)) {
          systemPrompt = systemPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value))
        }
      }

      // 3. Crear agente desde template
      const agent = await agentsService.create({
        tenantId,
        name: `${template.name} - Agent`,
        type: template.type as any || "INTERNAL",
        status: "ACTIVE",
        accessType: "PRIVATE",
        role: systemPrompt,
        instructions: config.instructions,
        language: "es",
        style: "amigable y profesional",
        allowedTools: config.tools || [],
        blockedTools: [],
        model: config.model,
        provider: config.provider,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      } as any)

      // 4. Crear knowledge entries por defecto segun el rubro
      const knowledgeItems = this.getDefaultKnowledge(template.slug, variables)
      for (const item of knowledgeItems) {
        await db.insert(knowledgeEntries).values({
          tenantId,
          agentId: agent.id,
          type: item.type,
          title: item.title,
          content: item.content,
          status: "ACTIVE",
        } as any)
      }

      // 5. Registrar instalacion del template
      await db.insert(agentTemplateInstallations).values({
        templateId,
        tenantId,
        agentId: agent.id,
        variables: variables || {},
        status: "active",
      })

      logger.info("Template deployed", {
        tenantId,
        templateId,
        agentId: agent.id,
        templateName: template.name,
      })

      return c.json({
        success: true,
        data: {
          agent,
          knowledgeCount: knowledgeItems.length,
        },
      })
    } catch (error: any) {
      if (error instanceof HTTPException) throw error
      logger.error("deployTemplate failed", { error: error.message })
      throw new HTTPException(500, { message: error.message })
    }
  }

  /**
   * Knowledge entries por defecto segun rubro
   */
  private getDefaultKnowledge(templateSlug: string, variables: Record<string, any> = {}): Array<{ type: string; title: string; content: string }> {
    const businessName = variables.business_name || "nuestro negocio"
    const common: Array<{ type: string; title: string; content: string }> = [
      {
        type: "POLICY",
        title: "Politica de atención",
        content: `Atendemos de lunes a domingo. El tiempo de respuesta es inmediato durante horario laboral. Fuera de horario se responde al dia siguiente.`,
      },
      {
        type: "FAQ",
        title: "Medios de pago",
        content: variables.payment_methods || "Aceptamos efectivo, transferencia bancaria y MercadoPago.",
      },
    ]

    const bySlug: Record<string, Array<{ type: string; title: string; content: string }>> = {
      "restaurante-comida": [
        { type: "PROCEDURE", title: "Flujo de pedido", content: "1. Cliente pide productos. 2. Confirmamos items y total. 3. Preguntamos si es delivery o retiro. 4. Para delivery: pedir direccion. 5. Crear orden." },
        { type: "FAQ", title: "Zonas de delivery", content: variables.delivery_zones || "Consultar zona de cobertura al momento del pedido." },
        { type: "FAQ", title: "Horarios", content: variables.business_hours || "Lunes a Domingo 11:00 - 23:00" },
      ],
      "farmacia": [
        { type: "POLICY", title: "Recetas medicas", content: "Los medicamentos que requieren receta solo se entregan presentando la receta correspondiente al retirar." },
        { type: "FAQ", title: "Horarios de guardia", content: variables.guard_hours || "Consultar horario de farmacia de guardia." },
      ],
      "tienda-ropa": [
        { type: "POLICY", title: "Politica de cambios", content: variables.return_policy || "Cambios hasta 30 dias con etiqueta puesta y sin uso." },
        { type: "PROCEDURE", title: "Como consultar talles", content: "Usar getProductDetails para ver talles disponibles. Siempre confirmar talle antes de agregar al carrito." },
      ],
      "supermercado": [
        { type: "FAQ", title: "Costo de delivery", content: `Delivery $${variables.delivery_cost || 500}. Envio gratis en compras mayores a $${variables.free_delivery_amount || 5000}.` },
        { type: "PROCEDURE", title: "Pedido minimo", content: "No hay monto minimo, pero el delivery tiene costo para pedidos menores al monto de envio gratis." },
      ],
      "servicios-profesionales": [
        { type: "PROCEDURE", title: "Agendar turno", content: "1. Consultar servicio. 2. Confirmar fecha y hora. 3. Registrar datos del cliente. 4. Confirmar turno." },
      ],
    }

    return [...common, ...(bySlug[templateSlug] || [])]
  }
}

export const agentsController = new AgentsController()
