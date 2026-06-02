import {
  pgTable,
  uuid,
  text,
  boolean,
  real,
  json,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { subscriptionTierEnum } from "./enums"

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tier: subscriptionTierEnum("tier").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    priceMonthly: real("price_monthly").default(0).notNull(),
    priceYearly: real("price_yearly"),
    currency: text("currency").default("USD").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    features: json("features").$type<string[]>().default([]).notNull(),
    limits: json("limits").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    isActiveIdx: index("plans_is_active_idx").on(table.isActive),
    tierIdx: index("plans_tier_idx").on(table.tier),
    tierUnique: uniqueIndex("plans_tier_unique").on(table.tier),
  })
)

// Relations defined in relations.ts

// Type exports
export type Plan = typeof plans.$inferSelect
export type NewPlan = typeof plans.$inferInsert
