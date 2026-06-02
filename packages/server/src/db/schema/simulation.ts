import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"

export const simulationSessions = pgTable(
  "simulation_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    agentId: uuid("agent_id").notNull(),
    config: json("config").$type<Record<string, unknown>>().default({}).notNull(),
    messages: json("messages").$type<unknown[]>().default([]).notNull(),
    status: text("status").default("active").notNull(),
    metrics: json("metrics").$type<Record<string, unknown>>().default({}).notNull(),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endedAt: timestamp("ended_at"),
  },
  (table) => ({
    tenantIdIdx: index("simulation_sessions_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("simulation_sessions_agent_id_idx").on(table.agentId),
  })
)

export const simulationLogs = pgTable(
  "simulation_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id").notNull().references(() => simulationSessions.id, { onDelete: "cascade" }),
    event: text("event").notNull(),
    details: json("details").$type<Record<string, unknown>>().default({}).notNull(),
    timestamp: timestamp("timestamp").defaultNow().notNull(),
  },
  (table) => ({
    sessionIdIdx: index("simulation_logs_session_id_idx").on(table.sessionId),
  })
)

// Relations defined in relations.ts

// Type exports
export type SimulationSession = typeof simulationSessions.$inferSelect
export type NewSimulationSession = typeof simulationSessions.$inferInsert
export type SimulationLog = typeof simulationLogs.$inferSelect
export type NewSimulationLog = typeof simulationLogs.$inferInsert
