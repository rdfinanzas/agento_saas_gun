import {
  pgTable,
  uuid,
  integer,
  date,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { tenants } from "./tenant"

export const tenantUsages = pgTable(
  "tenant_usages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    requestsCount: integer("requests_count").default(0).notNull(),
    whatsappMessages: integer("whatsapp_messages").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantDateUnique: uniqueIndex("tenant_usages_tenant_id_date_unique").on(table.tenantId, table.date),
  })
)

// Relations defined in relations.ts

// Type exports
export type TenantUsage = typeof tenantUsages.$inferSelect
export type NewTenantUsage = typeof tenantUsages.$inferInsert
