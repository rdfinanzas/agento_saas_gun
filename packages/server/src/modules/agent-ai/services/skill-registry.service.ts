/**
 * SkillRegistry Service
 *
 * Carga y gestiona skills desde la base de datos.
 * Skills son instrucciones predefinidas que guían el comportamiento del agente.
 */

import { db } from "@/db/connection"
import { skills, type Skill, type NewSkill } from "@/db/schema/skill"
import { eq, and, or, isNull, inArray } from "drizzle-orm"
import { createLogger } from "@/utils/logger"

const logger = createLogger("skill-registry")

// ============================================
// Types
// ============================================

export interface SkillDefinition {
  id: string
  name: string
  description: string
  instructions: string
  tools: string[]
  isSystem: boolean
}

// ============================================
// Skills del Agente Codificador (MASTER)
// ============================================

const CODER_SKILLS: Omit<NewSkill, "tenantId" | "id" | "createdAt" | "updatedAt">[] = [
  {
    name: "create_agent",
    description: "Crear nuevos agentes especializados",
    instructions: `Eres el Agente Codificador de AgenTo.
Analiza la documentación proporcionada por el usuario.
Crea agentes con las tools apropiadas para su función.
Guarda todo en la base de datos.
El agente creado debe tener:
- Un nombre descriptivo
- Un tipo (INTERNAL o EXTERNAL)
- Un prompt del sistema claro
- Las tools necesarias para su función`,
    tools: ["create_agent"],
    agentId: null,
    isSystem: true,
  },
  {
    name: "create_tool",
    description: "Crear herramientas para agents",
    instructions: `Eres el Agente Codificador de AgenTo.
Genera código JavaScript para la tool solicitada.
La tool debe ser segura y auditorable.
Guarda la tool en la base de datos.
La tool debe:
- Tener un nombre descriptivo
- Tener una descripción clara
- Tener un schema de parámetros
- Retornar un resultado con success y data/error`,
    tools: ["create_tool"],
    agentId: null,
    isSystem: true,
  },
  {
    name: "configure_agent",
    description: "Configurar agentes existentes",
    instructions: `Eres el Agente Codificador de AgenTo.
Modifica prompts, tools, y comportamiento de agentes existentes.
Solo modifica agentes del tenant del usuario.
Los cambios deben:
- Mantener la funcionalidad existente
- Ser compatibles con el tipo de agente
- No romper integraciones existentes`,
    tools: ["read", "write"],
    agentId: null,
    isSystem: true,
  },
  {
    name: "integrate_api",
    description: "Integrar APIs externas",
    instructions: `Eres el Agente Codificador de AgenTo.
Lee la documentación de la API proporcionada.
Genera código de integración.
Crea una tool que el agente pueda usar.
La integración debe:
- Manejar errores apropiadamente
- Ser segura (no exponer credenciales)
- Tener timeouts apropiados`,
    tools: ["create_tool", "bash"],
    agentId: null,
    isSystem: true,
  },
]

// ============================================
// SkillRegistry Class
// ============================================

class SkillRegistry {
  private skillsCache: Map<string, SkillDefinition> = new Map()

  /**
   * Inicializa las skills del codificador para un tenant
   */
  async initializeCoderSkills(tenantId: string): Promise<void> {
    logger.info(`Initializing coder skills for tenant ${tenantId}`)

    for (const skillData of CODER_SKILLS) {
      // Verificar si ya existe
      const [existing] = await db
        .select()
        .from(skills)
        .where(
          and(
            eq(skills.tenantId, tenantId),
            eq(skills.name, skillData.name as string),
            eq(skills.isSystem, true)
          )
        )
        .limit(1)

      if (!existing) {
        await db.insert(skills).values({
          tenantId,
          ...skillData,
        })
        logger.info(`Created coder skill: ${skillData.name}`)
      }
    }
  }

  /**
   * Obtiene una skill por nombre
   */
  async getSkill(name: string, tenantId: string): Promise<SkillDefinition | null> {
    const cacheKey = `${tenantId}:${name}`

    if (this.skillsCache.has(cacheKey)) {
      return this.skillsCache.get(cacheKey)!
    }

    const [skill] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.tenantId, tenantId), eq(skills.name, name)))
      .limit(1)

    if (!skill) {
      return null
    }

    const skillDef = this.mapToDefinition(skill)
    this.skillsCache.set(cacheKey, skillDef)
    return skillDef
  }

  /**
   * Obtiene una skill por ID
   */
  async getSkillById(skillId: string, tenantId: string): Promise<SkillDefinition | null> {
    const cacheKey = `${tenantId}:id:${skillId}`

    if (this.skillsCache.has(cacheKey)) {
      return this.skillsCache.get(cacheKey)!
    }

    const [skill] = await db
      .select()
      .from(skills)
      .where(and(eq(skills.tenantId, tenantId), eq(skills.id, skillId)))
      .limit(1)

    if (!skill) {
      return null
    }

    const skillDef = this.mapToDefinition(skill)
    this.skillsCache.set(cacheKey, skillDef)
    return skillDef
  }

  /**
   * Obtiene todas las skills disponibles para un agente
   */
  async getSkillsForAgent(
    tenantId: string,
    agentId: string,
    agentType: "MASTER" | "INTERNAL" | "EXTERNAL"
  ): Promise<SkillDefinition[]> {
    const result: SkillDefinition[] = []

    // 1. Skills globales del codificador (agentId = null)
    const globalSkills = await db
      .select()
      .from(skills)
      .where(and(eq(skills.tenantId, tenantId), isNull(skills.agentId)))

    for (const skill of globalSkills) {
      result.push(this.mapToDefinition(skill))
    }

    // 2. Skills específicas del agente
    const agentSkills = await db
      .select()
      .from(skills)
      .where(and(eq(skills.tenantId, tenantId), eq(skills.agentId, agentId)))

    for (const skill of agentSkills) {
      result.push(this.mapToDefinition(skill))
    }

    return result
  }

  /**
   * Crea una nueva skill
   */
  async createSkill(
    tenantId: string,
    data: {
      name: string
      description?: string
      instructions: string
      tools?: string[]
      agentId?: string
    }
  ): Promise<SkillDefinition> {
    const [skill] = await db
      .insert(skills)
      .values({
        tenantId,
        name: data.name,
        description: data.description || "",
        instructions: data.instructions,
        tools: data.tools || [],
        agentId: data.agentId || null,
        isSystem: false,
      })
      .returning()

    const skillDef = this.mapToDefinition(skill)
    this.skillsCache.set(`${tenantId}:${skill.name}`, skillDef)
    return skillDef
  }

  /**
   * Actualiza una skill existente
   */
  async updateSkill(
    skillId: string,
    tenantId: string,
    data: Partial<{
      name: string
      description: string
      instructions: string
      tools: string[]
    }>
  ): Promise<SkillDefinition | null> {
    const [skill] = await db
      .update(skills)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(skills.id, skillId), eq(skills.tenantId, tenantId)))
      .returning()

    if (!skill) {
      return null
    }

    // Invalidar cache
    for (const key of this.skillsCache.keys()) {
      if (key.startsWith(tenantId)) {
        this.skillsCache.delete(key)
      }
    }

    return this.mapToDefinition(skill)
  }

  /**
   * Elimina una skill
   */
  async deleteSkill(skillId: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(skills)
      .where(and(eq(skills.id, skillId), eq(skills.tenantId, tenantId)))
      .returning()

    // Invalidar cache
    for (const key of this.skillsCache.keys()) {
      if (key.startsWith(tenantId)) {
        this.skillsCache.delete(key)
      }
    }

    return result.length > 0
  }

  /**
   * Obtiene los nombres de tools asociados a skills
   */
  async getToolsFromSkills(skillNames: string[], tenantId: string): Promise<string[]> {
    const tools = new Set<string>()

    for (const name of skillNames) {
      const skill = await this.getSkill(name, tenantId)
      if (skill) {
        skill.tools.forEach((t) => tools.add(t))
      }
    }

    return Array.from(tools)
  }

  /**
   * Limpia el cache
   */
  clearCache(tenantId?: string): void {
    if (tenantId) {
      for (const key of this.skillsCache.keys()) {
        if (key.startsWith(tenantId)) {
          this.skillsCache.delete(key)
        }
      }
    } else {
      this.skillsCache.clear()
    }
  }

  /**
   * Mapea de DB a definición
   */
  private mapToDefinition(skill: Skill): SkillDefinition {
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description || "",
      instructions: skill.instructions,
      tools: skill.tools,
      isSystem: skill.isSystem,
    }
  }
}

// Singleton
export const skillRegistry = new SkillRegistry()
