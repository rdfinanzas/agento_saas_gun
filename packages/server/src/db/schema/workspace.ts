import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  json,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core"
import { taskStatusEnum, fileTypeEnum } from "./enums"

// ============================================
// WORKSPACES - Directorios de trabajo por tenant
// ============================================
export const workspaces = pgTable(
  "workspaces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().unique(),

    // Ruta del workspace en filesystem
    path: text("path").notNull(),

    // Estado
    isActive: boolean("is_active").default(true).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("workspaces_tenant_id_idx").on(table.tenantId),
    isActiveIdx: index("workspaces_is_active_idx").on(table.isActive),
  })
)

export type Workspace = typeof workspaces.$inferSelect
export type NewWorkspace = typeof workspaces.$inferInsert

// ============================================
// ACCOMPLISH TASKS - Tareas del agente codificador
// ============================================

export const accomplishTasks = pgTable(
  "accomplish_tasks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenantId").notNull(),
    userId: text("userId"), // User who created the task
    prompt: text("prompt").notNull(),
    status: taskStatusEnum("status").default("QUEUED").notNull(),
    sessionId: text("sessionId"),
    messages: jsonb("messages").$type<unknown[]>().default([]).notNull(),
    result: jsonb("result").$type<unknown>(),
    error: text("error"),
    workspacePath: text("workspacePath"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
  },
  (table) => ({
    tenantIdIdx: index("accomplish_tasks_tenant_id_idx").on(table.tenantId),
    userIdIdx: index("accomplish_tasks_user_id_idx").on(table.userId),
    statusIdx: index("accomplish_tasks_status_idx").on(table.status),
    sessionIdIdx: index("accomplish_tasks_session_id_idx").on(table.sessionId),
    createdAtIdx: index("accomplish_tasks_created_at_idx").on(table.createdAt),
  })
)

export const workspaceFiles = pgTable(
  "workspace_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    taskId: uuid("task_id").references(() => accomplishTasks.id, { onDelete: "cascade" }),
    type: fileTypeEnum("type").default("USER").notNull(),
    path: text("path").notNull(),
    name: text("name").notNull(),
    size: integer("size").notNull(),
    expiresAt: timestamp("expires_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("workspace_files_tenant_id_idx").on(table.tenantId),
    taskIdIdx: index("workspace_files_task_id_idx").on(table.taskId),
    typeIdx: index("workspace_files_type_idx").on(table.type),
    expiresAtIdx: index("workspace_files_expires_at_idx").on(table.expiresAt),
  })
)

// Relations defined in relations.ts

// Type exports
export type AccomplishTask = typeof accomplishTasks.$inferSelect
export type NewAccomplishTask = typeof accomplishTasks.$inferInsert
export type WorkspaceFile = typeof workspaceFiles.$inferSelect
export type NewWorkspaceFile = typeof workspaceFiles.$inferInsert
