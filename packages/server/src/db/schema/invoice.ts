import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { invoiceStatusEnum } from "./enums"

export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    subscriptionId: uuid("subscription_id").notNull(),
    number: text("number").notNull().unique(),
    amount: real("amount").notNull(),
    currency: text("currency").default("MXN").notNull(),
    tax: real("tax"),
    discount: real("discount"),
    couponId: text("coupon_id"),
    status: invoiceStatusEnum("status").default("OPEN").notNull(),
    paymentMethod: text("payment_method"),
    paymentReference: text("payment_reference"),
    paidAt: timestamp("paid_at"),
    dueDate: timestamp("due_date"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("invoices_tenant_id_idx").on(table.tenantId),
    statusIdx: index("invoices_status_idx").on(table.status),
    numberUnique: uniqueIndex("invoices_number_unique").on(table.number),
  })
)

// Relations defined in relations.ts

// Type exports
export type Invoice = typeof invoices.$inferSelect
export type NewInvoice = typeof invoices.$inferInsert
