import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { agentTypeEnum, agentStatusEnum, agentAccessTypeEnum } from "./enums"

export const agents = pgTable(
  "agents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),

    // Agent type
    type: agentTypeEnum("type").default("INTERNAL").notNull(),

    // Status
    status: agentStatusEnum("status").default("DRAFT").notNull(),

    // Identity
    role: text("role"),
    style: text("style"),
    language: text("language").default("es"),

    // Configuration
    systemPrompt: text("system_prompt"),
    instructions: text("instructions"),

    // Access configuration
    accessType: agentAccessTypeEnum("access_type").default("PRIVATE").notNull(),

    // Workspace (for internal agents)
    workspaceEnabled: boolean("workspace_enabled").default(false).notNull(),

    // Tool configuration
    allowedTools: text("allowed_tools").array().default([]).notNull(),
    blockedTools: text("blocked_tools").array().default([]).notNull(),

    // Hierarchy (parent agent)
    parentId: uuid("parent_id"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("agents_tenant_id_idx").on(table.tenantId),
    typeIdx: index("agents_type_idx").on(table.type),
    statusIdx: index("agents_status_idx").on(table.status),
    parentIdIdx: index("agents_parent_id_idx").on(table.parentId),
  })
)

// Relations defined in relations.ts

// Type exports
export type Agent = typeof agents.$inferSelect
export type NewAgent = typeof agents.$inferInsert
