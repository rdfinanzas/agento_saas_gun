import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  json,
} from "drizzle-orm/pg-core"
import { integrationTypeEnum, integrationStatusEnum } from "./enums"

export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    type: integrationTypeEnum("type").notNull(),

    // Configuration
    credentials: text("credentials").notNull(),
    baseUrl: text("base_url"),
    webhookUrl: text("webhook_url"),

    // Status
    status: integrationStatusEnum("status").default("PENDING").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantNameUnique: uniqueIndex("integrations_tenant_id_name_unique").on(table.tenantId, table.name),
    tenantIdIdx: index("integrations_tenant_id_idx").on(table.tenantId),
  })
)

export const agentIntegrations = pgTable(
  "agent_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agentId: uuid("agent_id").notNull(),
    integrationId: uuid("integration_id").notNull(),

    // Generated tools
    tools: json("tools").$type<unknown[]>().default([]).notNull(),

    // Specific configuration
    config: json("config").$type<Record<string, unknown>>(),

    // Status
    status: integrationStatusEnum("status").default("ACTIVE").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    agentIntegrationUnique: uniqueIndex("agent_integrations_agent_id_integration_id_unique").on(
      table.agentId,
      table.integrationId
    ),
  })
)

// Relations defined in relations.ts

// Type exports
export type Integration = typeof integrations.$inferSelect
export type NewIntegration = typeof integrations.$inferInsert
export type AgentIntegration = typeof agentIntegrations.$inferSelect
export type NewAgentIntegration = typeof agentIntegrations.$inferInsert
