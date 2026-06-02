import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"

export const scheduledTasks = pgTable(
  "scheduled_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    cronExpression: text("cron_expression").notNull(),
    taskType: text("task_type").notNull(),
    taskConfig: json("task_config").$type<Record<string, unknown>>().default({}).notNull(),
    agentId: uuid("agent_id"),
    enabled: boolean("enabled").default(true).notNull(),
    timezone: text("timezone").default("America/Mexico_City").notNull(),
    lastRunAt: timestamp("last_run_at"),
    nextRunAt: timestamp("next_run_at"),
    runCount: integer("run_count").default(0).notNull(),
    
    // SP-8: Campos para ejecución de tools
    toolId: uuid("tool_id"), // Tool del sistema o user tool a ejecutar
    toolType: text("tool_type"), // "system" | "user"
    toolName: text("tool_name"), // Nombre de la tool
    toolParams: json("tool_params").$type<Record<string, unknown>>().default({}),
    
    // Configuración de notificaciones
    notifyOnSuccess: boolean("notify_on_success").default(false),
    notifyOnFailure: boolean("notify_on_failure").default(true),
    webhookUrl: text("webhook_url"),
    
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("scheduled_tasks_tenant_id_idx").on(table.tenantId),
    enabledIdx: index("scheduled_tasks_enabled_idx").on(table.enabled),
    toolIdIdx: index("scheduled_tasks_tool_id_idx").on(table.toolId),
    nextRunAtIdx: index("scheduled_tasks_next_run_at_idx").on(table.nextRunAt),
  })
)

export const taskExecutions = pgTable(
  "task_executions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    taskId: uuid("task_id").notNull().references(() => scheduledTasks.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull(),
    status: text("status").default("pending").notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    result: json("result").$type<unknown>(),
    error: text("error"),
  },
  (table) => ({
    taskIdIdx: index("task_executions_task_id_idx").on(table.taskId),
    tenantIdIdx: index("task_executions_tenant_id_idx").on(table.tenantId),
    statusIdx: index("task_executions_status_idx").on(table.status),
  })
)

// Relations defined in relations.ts

// Type exports
export type ScheduledTask = typeof scheduledTasks.$inferSelect
export type NewScheduledTask = typeof scheduledTasks.$inferInsert
export type TaskExecution = typeof taskExecutions.$inferSelect
export type NewTaskExecution = typeof taskExecutions.$inferInsert
