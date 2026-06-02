/**
 * Tools Schema
 *
 * Tools son funciones ejecutables que los agentes pueden usar.
 * - Tools base del codificador: agentId = null (read, write, bash, etc.)
 * - Tools custom: agentId = agent.id (creadas por el codificador)
 *
 * El código se ejecuta en un Bun sandbox para seguridad.
 */
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core"

// JSON Schema para parámetros (compatible con Zod)
export type ToolParameterSchema = {
  type: string
  properties?: Record<string, {
    type: string
    description?: string
    required?: boolean
  }>
  required?: string[]
}

export const tools = pgTable(
  "tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Propietario: null = tool global del codificador, o agentId específico
    agentId: uuid("agent_id"),

    // Identificación
    name: text("name").notNull(),
    description: text("description"),

    // Código ejecutable (JavaScript/TypeScript)
    code: text("code").notNull(),

    // Esquema de parámetros (JSON Schema compatible con Zod)
    parameters: json("parameters").notNull().$type<ToolParameterSchema>(),

    // Permisos
    canExecuteCode: boolean("can_execute_code").default(false).notNull(),
    isSystem: boolean("is_system").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("tools_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("tools_agent_id_idx").on(table.agentId),
    isSystemIdx: index("tools_is_system_idx").on(table.isSystem),
    canExecuteCodeIdx: index("tools_can_execute_code_idx").on(table.canExecuteCode),
  })
)

// Type exports
export type Tool = typeof tools.$inferSelect
export type NewTool = typeof tools.$inferInsert
