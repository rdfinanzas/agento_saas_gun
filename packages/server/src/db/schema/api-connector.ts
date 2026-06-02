import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"

export const apiConnectors = pgTable(
  "api_connectors",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    baseUrl: text("base_url").notNull(),
    authType: text("auth_type").default("none").notNull(),
    authConfig: json("auth_config").$type<Record<string, unknown>>().default({}),
    tools: json("tools").$type<unknown[]>().default([]).notNull(),
    rawDocumentation: json("raw_documentation").$type<unknown>(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("api_connectors_tenant_id_idx").on(table.tenantId),
    isActiveIdx: index("api_connectors_is_active_idx").on(table.isActive),
  })
)

// Type exports
export type ApiConnector = typeof apiConnectors.$inferSelect
export type NewApiConnector = typeof apiConnectors.$inferInsert
