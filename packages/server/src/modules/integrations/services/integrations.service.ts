/**
 * Integrations Service - Gestion de integraciones externas
 */

import { eq, and, desc } from "drizzle-orm"
import { db } from "../../../db"
import { integrations, agentIntegrations } from "../../../db/schema"
import type { IntegrationType, IntegrationStatus } from "../../../db/schema"

export interface CreateIntegrationInput {
  tenantId: string
  name: string
  type: IntegrationType
  credentials: string
  baseUrl?: string
  webhookUrl?: string
}

export interface UpdateIntegrationInput {
  name?: string
  credentials?: string
  baseUrl?: string
  webhookUrl?: string
  status?: IntegrationStatus
}

export interface IntegrationFilterOptions {
  tenantId: string
  type?: IntegrationType
  status?: IntegrationStatus
  search?: string
  page?: number
  limit?: number
}

export interface TestConnectionResult {
  success: boolean
  message: string
  details?: Record<string, unknown>
}

export interface IntegrationWithAgents {
  id: string
  tenantId: string
  name: string
  type: string
  credentials: string
  baseUrl: string | null
  webhookUrl: string | null
  status: string
  createdAt: Date
  updatedAt: Date
  agents?: Array<{
    id: string
    agentId: string
    config: Record<string, unknown> | null
    status: string
  }>
  _count?: {
    agents: number
  }
}

class IntegrationsService {
  /**
   * Crea una nueva integracion
   */
  async create(data: CreateIntegrationInput) {
    // Verificar que no exista una integracion con el mismo nombre en el tenant
    const existing = await db.query.integrations.findFirst({
      where: and(
        eq(integrations.tenantId, data.tenantId),
        eq(integrations.name, data.name)
      ),
    })

    if (existing) {
      throw new Error("Ya existe una integracion con ese nombre")
    }

    const [integration] = await db
      .insert(integrations)
      .values({
        tenantId: data.tenantId,
        name: data.name,
        type: data.type,
        credentials: data.credentials,
        baseUrl: data.baseUrl,
        webhookUrl: data.webhookUrl,
        status: "PENDING",
      })
      .returning()

    return integration
  }

  /**
   * Obtiene una integracion por ID
   */
  async getById(id: string, tenantId: string): Promise<IntegrationWithAgents | null> {
    const integration = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)),
      with: {
        agentIntegrations: {
          columns: {
            id: true,
            agentId: true,
            config: true,
            status: true,
          },
        },
      },
    })

    if (!integration) return null

    // Transformar el resultado
    const result: IntegrationWithAgents = {
      ...integration,
      agents: integration.agentIntegrations?.map((ai) => ({
        id: ai.id,
        agentId: ai.agentId,
        config: ai.config,
        status: ai.status,
      })),
      _count: {
        agents: integration.agentIntegrations?.length || 0,
      },
    }

    return result
  }

  /**
   * Lista integraciones con filtros y paginacion
   */
  async list(options: IntegrationFilterOptions) {
    const { tenantId, type, status, search, page = 1, limit = 20 } = options
    const skip = (page - 1) * limit

    // Construir condiciones where
    const conditions = [eq(integrations.tenantId, tenantId)]

    if (type) conditions.push(eq(integrations.type, type))
    if (status) conditions.push(eq(integrations.status, status))

    const integrationsList = await db.query.integrations.findMany({
      where: and(...conditions),
      limit,
      offset: skip,
      orderBy: [desc(integrations.createdAt)],
    })

    // Filtrar por busqueda si existe
    let filteredList = integrationsList
    if (search) {
      const searchLower = search.toLowerCase()
      filteredList = integrationsList.filter(
        (i) =>
          i.name.toLowerCase().includes(searchLower) ||
          i.type.toLowerCase().includes(searchLower)
      )
    }

    // Obtener conteo total
    const allIntegrations = await db.query.integrations.findMany({
      where: and(...conditions),
      columns: { id: true },
    })

    const total = allIntegrations.length

    return {
      integrations: filteredList,
      total,
      page,
      limit,
    }
  }

  /**
   * Actualiza una integracion
   */
  async update(id: string, tenantId: string, data: UpdateIntegrationInput) {
    // Verificar que la integracion existe y pertenece al tenant
    const existing = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)),
    })

    if (!existing) {
      throw new Error("Integracion no encontrada")
    }

    // Si se cambia el nombre, verificar que no exista otro con el mismo nombre
    if (data.name && data.name !== existing.name) {
      const duplicate = await db.query.integrations.findFirst({
        where: and(
          eq(integrations.tenantId, tenantId),
          eq(integrations.name, data.name)
        ),
      })

      if (duplicate) {
        throw new Error("Ya existe una integracion con ese nombre")
      }
    }

    const [updated] = await db
      .update(integrations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, id))
      .returning()

    return updated
  }

  /**
   * Elimina una integracion
   */
  async delete(id: string, tenantId: string) {
    const existing = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)),
      with: {
        agentIntegrations: true,
      },
    })

    if (!existing) {
      throw new Error("Integracion no encontrada")
    }

    // Verificar si tiene agentes asociados
    if (existing.agentIntegrations && existing.agentIntegrations.length > 0) {
      throw new Error("No se puede eliminar una integracion con agentes asociados")
    }

    await db.delete(integrations).where(eq(integrations.id, id))

    return { success: true, message: "Integracion eliminada correctamente" }
  }

  /**
   * Activa una integracion
   */
  async activate(id: string, tenantId: string) {
    return this.setStatus(id, tenantId, "ACTIVE")
  }

  /**
   * Desactiva una integracion
   */
  async deactivate(id: string, tenantId: string) {
    return this.setStatus(id, tenantId, "DISABLED")
  }

  /**
   * Cambia el estado de una integracion
   */
  async setStatus(id: string, tenantId: string, status: IntegrationStatus) {
    const existing = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)),
    })

    if (!existing) {
      throw new Error("Integracion no encontrada")
    }

    const [updated] = await db
      .update(integrations)
      .set({ status, updatedAt: new Date() })
      .where(eq(integrations.id, id))
      .returning()

    return updated
  }

  /**
   * Prueba la conexion de una integracion
   */
  async testConnection(id: string, tenantId: string): Promise<TestConnectionResult> {
    const integration = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, id), eq(integrations.tenantId, tenantId)),
    })

    if (!integration) {
      throw new Error("Integracion no encontrada")
    }

    try {
      // Segun el tipo de integracion, realizar la prueba correspondiente
      switch (integration.type) {
        case "CRM":
          return await this.testCrmConnection(integration)
        case "ERP":
          return await this.testErpConnection(integration)
        case "ECOMMERCE":
          return await this.testEcommerceConnection(integration)
        case "CUSTOM_API":
          return await this.testCustomApiConnection(integration)
        case "GOOGLE":
          return await this.testGoogleConnection(integration)
        case "MICROSOFT":
          return await this.testMicrosoftConnection(integration)
        default:
          return {
            success: false,
            message: `Tipo de integracion no soportado: ${integration.type}`,
          }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Error desconocido"
      return {
        success: false,
        message: `Error al probar conexion: ${errorMessage}`,
      }
    }
  }

  /**
   * Prueba conexion CRM (ejemplo generico)
   */
  private async testCrmConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    if (!integration.baseUrl) {
      return { success: false, message: "URL base no configurada" }
    }

    try {
      const response = await fetch(`${integration.baseUrl}/api/v1/ping`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${integration.credentials}`,
        },
      })

      if (response.ok) {
        return {
          success: true,
          message: "Conexion exitosa al CRM",
          details: { status: response.status },
        }
      }

      return {
        success: false,
        message: `Error de conexion: ${response.status} ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        message: "No se pudo conectar al CRM",
      }
    }
  }

  /**
   * Prueba conexion ERP (ejemplo generico)
   */
  private async testErpConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    if (!integration.baseUrl) {
      return { success: false, message: "URL base no configurada" }
    }

    try {
      const response = await fetch(`${integration.baseUrl}/health`, {
        method: "GET",
        headers: {
          "X-API-Key": integration.credentials,
        },
      })

      if (response.ok) {
        return {
          success: true,
          message: "Conexion exitosa al ERP",
          details: { status: response.status },
        }
      }

      return {
        success: false,
        message: `Error de conexion: ${response.status} ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        message: "No se pudo conectar al ERP",
      }
    }
  }

  /**
   * Prueba conexion E-commerce (ejemplo generico)
   */
  private async testEcommerceConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    if (!integration.baseUrl) {
      return { success: false, message: "URL base no configurada" }
    }

    try {
      const response = await fetch(`${integration.baseUrl}/api/status`, {
        method: "GET",
        headers: {
          "X-Auth-Token": integration.credentials,
        },
      })

      if (response.ok) {
        return {
          success: true,
          message: "Conexion exitosa a la tienda",
          details: { status: response.status },
        }
      }

      return {
        success: false,
        message: `Error de conexion: ${response.status} ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        message: "No se pudo conectar a la tienda",
      }
    }
  }

  /**
   * Prueba conexion API personalizada
   */
  private async testCustomApiConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    if (!integration.baseUrl) {
      return { success: false, message: "URL base no configurada" }
    }

    try {
      const response = await fetch(integration.baseUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${integration.credentials}`,
        },
      })

      if (response.ok) {
        return {
          success: true,
          message: "Conexion exitosa a la API",
          details: { status: response.status },
        }
      }

      return {
        success: false,
        message: `Error de conexion: ${response.status} ${response.statusText}`,
      }
    } catch (error) {
      return {
        success: false,
        message: "No se pudo conectar a la API",
      }
    }
  }

  /**
   * Prueba conexion Google (placeholder)
   */
  private async testGoogleConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    // Placeholder - en produccion se verificaria el token OAuth
    return {
      success: true,
      message: "Credenciales de Google configuradas (verificacion pendiente)",
      details: { type: "oauth2" },
    }
  }

  /**
   * Prueba conexion Microsoft (placeholder)
   */
  private async testMicrosoftConnection(integration: typeof integrations.$inferSelect): Promise<TestConnectionResult> {
    // Placeholder - en produccion se verificaria el token OAuth
    return {
      success: true,
      message: "Credenciales de Microsoft configuradas (verificacion pendiente)",
      details: { type: "oauth2" },
    }
  }

  /**
   * Obtiene integraciones por tipo
   */
  async getByType(tenantId: string, type: IntegrationType) {
    return db.query.integrations.findMany({
      where: and(eq(integrations.tenantId, tenantId), eq(integrations.type, type)),
      orderBy: [desc(integrations.createdAt)],
    })
  }

  /**
   * Obtiene integraciones activas de un tenant
   */
  async getActiveIntegrations(tenantId: string) {
    return db.query.integrations.findMany({
      where: and(eq(integrations.tenantId, tenantId), eq(integrations.status, "ACTIVE")),
      orderBy: [desc(integrations.createdAt)],
    })
  }

  /**
   * Obtiene estadisticas de integraciones
   */
  async getStats(tenantId: string) {
    const allIntegrations = await db.query.integrations.findMany({
      where: eq(integrations.tenantId, tenantId),
    })

    const byStatus = {
      pending: allIntegrations.filter((i) => i.status === "PENDING").length,
      active: allIntegrations.filter((i) => i.status === "ACTIVE").length,
      error: allIntegrations.filter((i) => i.status === "ERROR").length,
      disabled: allIntegrations.filter((i) => i.status === "DISABLED").length,
    }

    const byType = {
      crm: allIntegrations.filter((i) => i.type === "CRM").length,
      erp: allIntegrations.filter((i) => i.type === "ERP").length,
      ecommerce: allIntegrations.filter((i) => i.type === "ECOMMERCE").length,
      accounting: allIntegrations.filter((i) => i.type === "ACCOUNTING").length,
      bank: allIntegrations.filter((i) => i.type === "BANK").length,
      customApi: allIntegrations.filter((i) => i.type === "CUSTOM_API").length,
      google: allIntegrations.filter((i) => i.type === "GOOGLE").length,
      microsoft: allIntegrations.filter((i) => i.type === "MICROSOFT").length,
    }

    return {
      total: allIntegrations.length,
      byStatus,
      byType,
    }
  }

  /**
   * Asocia una integracion a un agente
   */
  async assignToAgent(integrationId: string, agentId: string, tenantId: string, config?: Record<string, unknown>) {
    // Verificar que la integracion pertenece al tenant
    const integration = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, integrationId), eq(integrations.tenantId, tenantId)),
    })

    if (!integration) {
      throw new Error("Integracion no encontrada")
    }

    // Verificar si ya existe la asociacion
    const existing = await db.query.agentIntegrations.findFirst({
      where: and(
        eq(agentIntegrations.agentId, agentId),
        eq(agentIntegrations.integrationId, integrationId)
      ),
    })

    if (existing) {
      throw new Error("La integracion ya esta asociada a este agente")
    }

    const [agentIntegration] = await db
      .insert(agentIntegrations)
      .values({
        agentId,
        integrationId,
        config,
        status: "ACTIVE",
      })
      .returning()

    return agentIntegration
  }

  /**
   * Desasocia una integracion de un agente
   */
  async unassignFromAgent(integrationId: string, agentId: string, tenantId: string) {
    // Verificar que la integracion pertenece al tenant
    const integration = await db.query.integrations.findFirst({
      where: and(eq(integrations.id, integrationId), eq(integrations.tenantId, tenantId)),
    })

    if (!integration) {
      throw new Error("Integracion no encontrada")
    }

    await db
      .delete(agentIntegrations)
      .where(
        and(
          eq(agentIntegrations.agentId, agentId),
          eq(agentIntegrations.integrationId, integrationId)
        )
      )

    return { success: true, message: "Integracion desasociada correctamente" }
  }
}

export const integrationsService = new IntegrationsService()
