/**
 * WhatsApp Config Service - Migrado a Drizzle
 */

import { eq, and } from "drizzle-orm"
import { db } from "../../../db"
import { whatsappConfigs, agents } from "../../../db/schema"

export interface CreateWhatsAppConfigInput {
  tenantId: string
  phoneNumber: string
  phoneNumberId: string
  businessAccountId: string
  accessToken: string
  webhookVerifyToken: string
  agentId?: string
  agentMode?: string
}

export interface UpdateWhatsAppConfigInput {
  phoneNumber?: string
  phoneNumberId?: string
  businessAccountId?: string
  accessToken?: string
  webhookVerifyToken?: string
  agentId?: string | null
  agentMode?: string
  isActive?: boolean
}

class WhatsAppConfigService {
  /**
   * Crea una nueva configuración de WhatsApp
   */
  async create(data: CreateWhatsAppConfigInput) {
    const [config] = await db
      .insert(whatsappConfigs)
      .values({
        tenantId: data.tenantId,
        phoneNumber: data.phoneNumber,
        phoneNumberId: data.phoneNumberId,
        businessAccountId: data.businessAccountId,
        accessToken: data.accessToken,
        webhookVerifyToken: data.webhookVerifyToken,
        agentId: data.agentId,
        agentMode: data.agentMode || "HYBRID",
        isActive: true,
      })
      .returning()

    return config
  }

  /**
   * Obtiene una configuración por ID
   */
  async getById(id: string, tenantId: string) {
    const config = await db.query.whatsappConfigs.findFirst({
      where: and(eq(whatsappConfigs.id, id), eq(whatsappConfigs.tenantId, tenantId)),
    })

    return config || null
  }

  /**
   * Lista todas las configuraciones de un tenant
   */
  async list(tenantId: string, includeInactive = false) {
    const conditions = [eq(whatsappConfigs.tenantId, tenantId)]

    if (!includeInactive) {
      conditions.push(eq(whatsappConfigs.isActive, true))
    }

    return db.query.whatsappConfigs.findMany({
      where: and(...conditions),
      with: {
        agent: true,
      },
    })
  }

  /**
   * Actualiza una configuración
   */
  async update(id: string, tenantId: string, data: UpdateWhatsAppConfigInput) {
    const existing = await this.getById(id, tenantId)

    if (!existing) {
      throw new Error("WhatsApp config not found")
    }

    const [updated] = await db
      .update(whatsappConfigs)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(whatsappConfigs.id, id))
      .returning()

    return updated
  }

  /**
   * Elimina una configuración (soft delete)
   */
  async delete(id: string, tenantId: string) {
    const existing = await this.getById(id, tenantId)

    if (!existing) {
      throw new Error("WhatsApp config not found")
    }

    const [deleted] = await db
      .update(whatsappConfigs)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(whatsappConfigs.id, id))
      .returning()

    return deleted
  }

  /**
   * Obtiene configuración por phoneNumberId
   */
  async getByPhoneNumberId(phoneNumberId: string) {
    const config = await db.query.whatsappConfigs.findFirst({
      where: eq(whatsappConfigs.phoneNumberId, phoneNumberId),
    })

    return config || null
  }

  /**
   * Vincula un agente a la configuración
   */
  async linkToAgent(id: string, tenantId: string, agentId: string) {
    // Verificar que el agente existe y pertenece al tenant
    const agent = await db.query.agents.findFirst({
      where: and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)),
    })

    if (!agent) {
      throw new Error("Agent not found")
    }

    return this.update(id, tenantId, { agentId })
  }

  /**
   * Desvincula el agente de la configuración
   */
  async unlinkFromAgent(id: string, tenantId: string) {
    return this.update(id, tenantId, { agentId: null })
  }
}

export const whatsappConfigService = new WhatsAppConfigService()
