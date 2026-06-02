/**
 * Usage Metrics Schema - SP-10: Monitoreo de Uso
 *
 * Registra métricas de uso: tokens, requests, storage, etc.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  integer,
  boolean,
  json,
} from "drizzle-orm/pg-core"

// Tipos de métricas
export const metricTypes = [
  "tokens", // Tokens de AI consumidos
  "requests", // Requests al agente
  "tool_executions", // Ejecuciones de herramientas
  "storage_bytes", // Almacenamiento usado
  "sessions", // Sesiones creadas
  "messages", // Mensajes intercambiados
  "approvals", // Solicitudes de aprobación
] as const

export type MetricType = typeof metricTypes[number]

// Períodos de agregación
export const metricPeriods = ["hourly", "daily", "weekly", "monthly"] as const
export type MetricPeriod = typeof metricPeriods[number]

export const usageMetrics = pgTable(
  "usage_metrics",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Tipo de métrica
    metricType: text("metric_type").$type<MetricType>().notNull(),

    // Valor acumulado
    value: integer("value").notNull().default(0),

    // Contexto
    model: text("model"), // Modelo de AI usado (para tokens)
    sessionId: uuid("session_id"), // Sesión específica (opcional)
    agentId: uuid("agent_id"), // Agente específico (opcional)
    toolName: text("tool_name"), // Herramienta específica (para tool_executions)

    // Metadatos adicionales
    metadata: json("metadata").$type<Record<string, any>>().default({}),

    // Período de agregación
    period: text("period").$type<MetricPeriod>().notNull(),
    periodStart: timestamp("period_start").notNull(),
    periodEnd: timestamp("period_end").notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("usage_metrics_tenant_id_idx").on(table.tenantId),
    metricTypeIdx: index("usage_metrics_metric_type_idx").on(table.metricType),
    periodIdx: index("usage_metrics_period_idx").on(table.period),
    tenantPeriodMetricIdx: index("usage_metrics_tenant_period_metric_idx").on(
      table.tenantId,
      table.periodStart,
      table.metricType
    ),
    sessionIdIdx: index("usage_metrics_session_id_idx").on(table.sessionId),
    agentIdIdx: index("usage_metrics_agent_id_idx").on(table.agentId),
  })
)

export type UsageMetric = typeof usageMetrics.$inferSelect
export type NewUsageMetric = typeof usageMetrics.$inferInsert

// Tabla para tracking en tiempo real (no agregado)
export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Tipo de evento
    eventType: text("event_type").notNull(), // token_usage, tool_execution, message_sent, etc.

    // Valor del evento
    value: integer("value").notNull(), // Cantidad de tokens, bytes, etc.

    // Contexto
    model: text("model"),
    sessionId: uuid("session_id"),
    agentId: uuid("agent_id"),
    toolName: text("tool_name"),
    metadata: json("metadata").$type<Record<string, any>>().default({}),

    // Timestamp
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("usage_events_tenant_id_idx").on(table.tenantId),
    eventTypeIdx: index("usage_events_event_type_idx").on(table.eventType),
    sessionIdIdx: index("usage_events_session_id_idx").on(table.sessionId),
    createdAtIdx: index("usage_events_created_at_idx").on(table.createdAt),
  })
)

export type UsageEvent = typeof usageEvents.$inferSelect
export type NewUsageEvent = typeof usageEvents.$inferInsert

// Tabla para tracking de cuotas y límites
export const usageQuotas = pgTable(
  "usage_quotas",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),

    // Tipo de cuota
    quotaType: text("quota_type").notNull(), // tokens_monthly, requests_daily, etc.

    // Límite
    limit: integer("limit").notNull(),
    used: integer("used").notNull().default(0),

    // Período de reset
    resetPeriod: text("reset_period").notNull(), // daily, weekly, monthly
    lastResetAt: timestamp("last_reset_at").notNull(),
    nextResetAt: timestamp("next_reset_at").notNull(),

    // Estado
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("usage_quotas_tenant_id_idx").on(table.tenantId),
    quotaTypeIdx: index("usage_quotas_quota_type_idx").on(table.quotaType),
  })
)

export type UsageQuota = typeof usageQuotas.$inferSelect
export type NewUsageQuota = typeof usageQuotas.$inferInsert
