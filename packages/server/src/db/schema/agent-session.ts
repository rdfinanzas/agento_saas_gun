/**
 * Agent Sessions Schema
 *
 * Sesiones de chat con el agente codificador.
 * Cada sesión mantiene el contexto de una conversación.
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

// Metadatos de sesión
export type AgentSessionMetadata = {
  model?: string // Modelo de AI usado
  provider?: string // Proveedor de AI
  totalTokens?: number
  totalCost?: number
  workspacePath?: string
  tags?: string[]
  [key: string]: unknown
}

export const agentSessions = pgTable(
  "agent_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id"), // Usuario que creó la sesión
    agentId: uuid("agent_id"), // Agente asociado (opcional)

    // Identificación
    title: text("title"), // Título de la sesión (generado del primer mensaje)
    directory: text("directory"), // Workspace path actual

    // Estado
    isActive: boolean("is_active").default(true).notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),

    // Metadatos
    metadata: json("metadata").$type<AgentSessionMetadata>().default({}),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    archivedAt: timestamp("archived_at"),
  },
  (table) => ({
    tenantIdIdx: index("agent_sessions_tenant_id_idx").on(table.tenantId),
    userIdIdx: index("agent_sessions_user_id_idx").on(table.userId),
    agentIdIdx: index("agent_sessions_agent_id_idx").on(table.agentId),
    isActiveIdx: index("agent_sessions_is_active_idx").on(table.isActive),
    isArchivedIdx: index("agent_sessions_is_archived_idx").on(table.isArchived),
    createdAtIdx: index("agent_sessions_created_at_idx").on(table.createdAt),
  })
)

// Type exports
export type AgentSession = typeof agentSessions.$inferSelect
export type NewAgentSession = typeof agentSessions.$inferInsert
