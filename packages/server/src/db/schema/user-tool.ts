/**
 * User Tools Schema
 * 
 * SP-5.1: Tabla para herramientas creadas por los usuarios
 * 
 * Características:
 * - Código JavaScript/TypeScript ejecutable
 * - Parámetros definidos con Zod schema
 * - Permisos granulares
 * - Versionado
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  integer,
  index,
} from "drizzle-orm/pg-core"

// Tipos de permisos para la tool
export type ToolPermission = 
  | "filesystem.read"     // Leer archivos del workspace
  | "filesystem.write"    // Escribir archivos
  | "network.http"        // Hacer requests HTTP
  | "network.external"    // Conexiones externas
  | "database.query"      // Queries a DB
  | "database.write"      // Writes a DB
  | "system.shell"        // Ejecutar shell
  | "system.process"      // Spawn procesos

// Estado de la tool
export const toolStatusEnum = ["draft", "active", "deprecated", "error"] as const
export type ToolStatus = typeof toolStatusEnum[number]

// Metadata de la tool
export type UserToolMetadata = {
  author?: string
  version?: string
  tags?: string[]
  icon?: string
  category?: string
  usageCount?: number
  lastUsedAt?: string
  averageExecutionTime?: number
}

// Definición de parámetro
export type ToolParameter = {
  name: string
  type: "string" | "number" | "boolean" | "array" | "object"
  description: string
  required: boolean
  default?: any
  enum?: any[]
}

export const userTools = pgTable(
  "user_tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    
    // Quién creó la tool
    createdBy: uuid("created_by"),
    
    // Identificación
    name: text("name").notNull(),
    slug: text("slug").notNull(), // URL-friendly name
    description: text("description"),
    
    // Código ejecutable
    code: text("code").notNull(),
    language: text("language").default("javascript").notNull(), // javascript, typescript
    
    // Schema de parámetros (Zod-like)
    parameters: json("parameters").$type<ToolParameter[]>().default([]),
    
    // Permisos requeridos
    permissions: json("permissions").$type<ToolPermission[]>().default([]),
    
    // Configuración de ejecución
    config: json("config").default({
      timeout: 30000,        // 30 segundos default
      maxMemory: 128,        // MB
      allowConsole: true,    // Permitir console.log
      retryOnError: false,
      maxRetries: 3,
    }),
    
    // Estado
    status: text("status").default("draft").notNull(),
    
    // Metadatos
    metadata: json("metadata").$type<UserToolMetadata>().default({}),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    
    // Soft delete
    deletedAt: timestamp("deleted_at"),
    isActive: boolean("is_active").default(true).notNull(),
  },
  (table) => ({
    tenantIdIdx: index("user_tools_tenant_id_idx").on(table.tenantId),
    slugIdx: index("user_tools_slug_idx").on(table.slug),
    statusIdx: index("user_tools_status_idx").on(table.status),
    tenantSlugIdx: index("user_tools_tenant_slug_idx").on(table.tenantId, table.slug),
  })
)

// Historial de ejecuciones
export const userToolExecutions = pgTable(
  "user_tool_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    
    // Quién ejecutó
    executedBy: uuid("executed_by"),
    sessionId: uuid("session_id"),
    
    // Input/Output
    input: json("input").default({}),
    output: json("output"),
    error: text("error"),
    
    // Métricas
    status: text("status").default("pending").notNull(), // pending, running, success, failed
    durationMs: integer("duration_ms"),
    memoryUsed: integer("memory_used"), // MB
    
    // Logs
    logs: json("logs").$type<string[]>().default([]),
    
    // Timestamps
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    
    // Para retry
    attempt: integer("attempt").default(1),
    maxAttempts: integer("max_attempts").default(1),
  },
  (table) => ({
    toolIdIdx: index("user_tool_executions_tool_id_idx").on(table.toolId),
    tenantIdIdx: index("user_tool_executions_tenant_id_idx").on(table.tenantId),
    statusIdx: index("user_tool_executions_status_idx").on(table.status),
    startedAtIdx: index("user_tool_executions_started_at_idx").on(table.startedAt),
  })
)

// Type exports
export type UserTool = typeof userTools.$inferSelect
export type NewUserTool = typeof userTools.$inferInsert
export type UserToolExecution = typeof userToolExecutions.$inferSelect
export type NewUserToolExecution = typeof userToolExecutions.$inferInsert
