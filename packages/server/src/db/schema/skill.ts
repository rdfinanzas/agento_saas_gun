/**
 * Skills Schema
 *
 * Skills son instrucciones predefinidas que guían el comportamiento del agente.
 * - Skills globales del codificador: agentId = null
 * - Skills específicas de un agente: agentId = agent.id
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"

export const skills = pgTable(
  "skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Propietario: null = skill global del codificador, o agentId específico
    agentId: uuid("agent_id"),

    // Identificación
    name: text("name").notNull(),
    description: text("description"),

    // Instrucciones del skill (prompt con comportamiento)
    instructions: text("instructions").notNull(),

    // Tools asociadas (nombres de tools)
    tools: text("tools").array().default([]).notNull(),

    // Sistema
    isSystem: boolean("is_system").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("skills_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("skills_agent_id_idx").on(table.agentId),
    isSystemIdx: index("skills_is_system_idx").on(table.isSystem),
  })
)

// Type exports
export type Skill = typeof skills.$inferSelect
export type NewSkill = typeof skills.$inferInsert
