/**
 * Audit Logs Schema - SP-9: Logs y Auditoría
 *
 * Registra todas las acciones importantes del sistema para auditoría
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"

// Tipos de acciones de auditoría
export const auditActions = [
  // Herramientas
  "tool_executed",
  "tool_failed",
  "tool_approved",
  "tool_rejected",
  // Credenciales
  "credential_created",
  "credential_updated",
  "credential_deleted",
  "credential_accessed",
  // Sesiones
  "session_created",
  "session_deleted",
  "session_archived",
  // Agentes
  "agent_created",
  "agent_updated",
  "agent_deleted",
  // Usuarios
  "user_login",
  "user_logout",
  "user_invited",
  // Scheduling
  "task_scheduled",
  "task_executed",
  "task_failed",
  // Workspace
  "workspace_created",
  "workspace_deleted",
  "file_uploaded",
  "file_downloaded",
  // Sistema
  "settings_updated",
  "api_key_created",
  "api_key_revoked",
] as const

export type AuditAction = typeof auditActions[number]

// Tipos de recursos
export const auditResourceTypes = [
  "tool",
  "credential",
  "session",
  "agent",
  "user",
  "schedule",
  "workspace",
  "file",
  "api_key",
  "setting",
] as const

export type AuditResourceType = typeof auditResourceTypes[number]

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id"),

    // Acción
    action: text("action").$type<AuditAction>().notNull(),

    // Recurso
    resourceType: text("resource_type").$type<AuditResourceType>(),
    resourceId: text("resource_id"),

    // Detalles adicionales
    details: json("details").$type<Record<string, any>>().default({}),

    // Resultado
    success: text("success").$type<"yes" | "no" | "partial">().default("yes").notNull(),
    errorMessage: text("error_message"),

    // IP/Cliente
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    requestId: text("request_id"), // Para correlacionar logs de una request

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("audit_logs_tenant_id_idx").on(table.tenantId),
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
    resourceIdx: index("audit_logs_resource_idx").on(table.resourceType, table.resourceId),
    createdAtIdx: index("audit_logs_created_at_idx").on(table.createdAt),
    requestIdIdx: index("audit_logs_request_id_idx").on(table.requestId),
  })
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
