import {
  pgTable,
  uuid,
  text,
  boolean,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { subscriptionTierEnum, subscriptionStatusEnum } from "./enums"

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenantId").notNull().unique(),
    planId: text("planId").notNull(),
    planName: text("planName").notNull(),
    tier: subscriptionTierEnum("tier").default("FREE").notNull(),
    status: subscriptionStatusEnum("status").default("PENDING").notNull(),
    cancelAtPeriodEnd: text("cancelAtPeriodEnd").default("false").notNull(),
    cancelledAt: timestamp("cancelledAt"),
    pausedAt: timestamp("pausedAt"),
    currentPeriodStart: timestamp("currentPeriodStart"),
    currentPeriodEnd: timestamp("currentPeriodEnd"),
    gateway: text("gateway").default("MERCADOPAGO").notNull(),
    gatewayCustomerId: text("gatewayCustomerId"),
    gatewayPreapprovalId: text("gatewayPreapprovalId"),
    autoRenew: text("autoRenew").default("true").notNull(),
    trialEnd: timestamp("trialEnd"),
    prorationCredit: text("prorationCredit").default("0").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("subscriptions_tenantId_idx").on(table.tenantId),
    statusIdx: index("subscriptions_status_idx").on(table.status),
    gatewayPreapprovalIdIdx: index("subscriptions_gatewayPreapprovalId_idx").on(table.gatewayPreapprovalId),
    tenantIdUnique: uniqueIndex("subscriptions_tenantId_unique").on(table.tenantId),
  })
)

// Relations defined in relations.ts

// Type exports
export type Subscription = typeof subscriptions.$inferSelect
export type NewSubscription = typeof subscriptions.$inferInsert
