/**
 * Tool Executions Schema - SP-9: Logs y Auditoría
 *
 * Registra cada ejecución de herramienta con sus resultados y métricas
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
  integer,
} from "drizzle-orm/pg-core"

export const toolExecutionStatuses = ["running", "success", "failed", "cancelled"] as const
export type ToolExecutionStatus = typeof toolExecutionStatuses[number]

export const toolExecutions = pgTable(
  "tool_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    sessionId: uuid("session_id"),

    // Tool ejecutada
    toolName: text("tool_name").notNull(),
    toolParams: json("tool_params").$type<any>(),

    // Resultado
    status: text("status").$type<ToolExecutionStatus>().default("running").notNull(),
    result: json("result").$type<any>(),
    error: text("error"),

    // Métricas
    durationMs: integer("duration_ms"),

    // Aprobación (si aplica)
    approvalId: uuid("approval_id"),
    requiresApproval: text("requires_approval").$type<"pending" | "approved" | "rejected" | "none">(),

    // Timestamps
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    tenantIdIdx: index("tool_executions_tenant_id_idx").on(table.tenantId),
    sessionIdIdx: index("tool_executions_session_id_idx").on(table.sessionId),
    statusIdx: index("tool_executions_status_idx").on(table.status),
    toolNameIdx: index("tool_executions_tool_name_idx").on(table.toolName),
    startedAtIdx: index("tool_executions_started_at_idx").on(table.startedAt),
  })
)

export type ToolExecution = typeof toolExecutions.$inferSelect
export type NewToolExecution = typeof toolExecutions.$inferInsert
