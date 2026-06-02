/**
 * Agent Messages Schema
 *
 * Mensajes de las sesiones de chat con el agente codificador.
 * Incluye mensajes del usuario, asistente, sistema y resultados de tools.
 */
import {
  pgTable,
  uuid,
  text,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core"

// Roles de mensaje
export const messageRoles = ["user", "assistant", "system", "tool"] as const
export type MessageRole = typeof messageRoles[number]

// Partes de un mensaje (para mensajes estructurados con contenido mixto)
export type MessagePart = {
  type: "text" | "image" | "code" | "tool_use" | "tool_result"
  content?: string
  language?: string // Para código
  toolName?: string
  toolInput?: unknown
  toolOutput?: unknown
  imageUrl?: string
}

// Metadatos del mensaje
export type AgentMessageMetadata = {
  model?: string
  tokens?: {
    prompt: number
    completion: number
    total: number
  }
  latency?: number // ms en generar respuesta
  finishReason?: string
}

export const agentMessages = pgTable(
  "agent_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),

    // Contenido
    role: text("role").notNull(), // user, assistant, system, tool
    content: text("content"), // Contenido principal (texto)

    // Para mensajes de tool
    toolName: text("tool_name"),
    toolCallId: text("tool_call_id"), // ID para correlacionar tool_use con tool_result
    toolInput: json("tool_input"),
    toolOutput: json("tool_output"),

    // Parts (para mensajes estructurados)
    parts: json("parts").$type<MessagePart[]>().default([]),

    // Metadatos
    metadata: json("metadata").$type<AgentMessageMetadata>(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("agent_messages_session_id_idx").on(table.sessionId),
    tenantIdIdx: index("agent_messages_tenant_id_idx").on(table.tenantId),
    roleIdx: index("agent_messages_role_idx").on(table.role),
    createdAtIdx: index("agent_messages_created_at_idx").on(table.createdAt),
  })
)

// Type exports
export type AgentMessage = typeof agentMessages.$inferSelect
export type NewAgentMessage = typeof agentMessages.$inferInsert
