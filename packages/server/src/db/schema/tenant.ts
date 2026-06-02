import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  json,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { subscriptionTierEnum } from "./enums"
import { relations } from "drizzle-orm"

export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    email: text("email").unique(),
    subscriptionTier: subscriptionTierEnum("subscriptionTier").default("FREE").notNull(),
    quotaMaxRequests: integer("quotaMaxRequests").default(1000).notNull(),
    quotaMaxStorage: bigint("quotaMaxStorage", { mode: "bigint" }).default(BigInt(1073741824)).notNull(),
    settings: json("settings").$type<Record<string, unknown>>(),
    integrations: json("integrations").$type<Record<string, unknown>>().default({}).notNull(),

    // Master ethics prompt - admin-only, injected into all agents
    masterPrompt: text("masterPrompt"),
    planId: uuid("planId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    subscriptionTierIdx: index("tenants_subscription_tier_idx").on(table.subscriptionTier),
    planIdIdx: index("tenants_plan_id_idx").on(table.planId),
    slugIdx: uniqueIndex("tenants_slug_unique").on(table.slug),
    emailIdx: uniqueIndex("tenants_email_unique").on(table.email),
  })
)

// Relations defined in relations.ts to avoid circular dependencies

// Type exports
export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
