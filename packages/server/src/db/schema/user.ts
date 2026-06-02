import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { tenantRoleEnum } from "./enums"
import { relations } from "drizzle-orm"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordhash: text("passwordhash").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
})

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenantId").notNull(),
    userId: uuid("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: tenantRoleEnum("role").default("MEMBER").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantUserUnique: uniqueIndex("tenant_users_tenant_id_user_id_unique").on(table.tenantId, table.userId),
    tenantIdIdx: index("tenant_users_tenant_id_idx").on(table.tenantId),
  })
)

// Relations defined in separate file to avoid circular deps
// Type exports
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type TenantUser = typeof tenantUsers.$inferSelect
export type NewTenantUser = typeof tenantUsers.$inferInsert
