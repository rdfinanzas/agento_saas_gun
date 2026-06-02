import {
  pgTable,
  uuid,
  text,
  real,
  timestamp,
  index,
  uniqueIndex,
  json,
} from "drizzle-orm/pg-core"

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenantId").notNull(),
    gateway: text("gateway").default("MERCADOPAGO").notNull(),
    gatewayPaymentId: text("gatewayPaymentId").notNull().unique(),
    amount: text("amount").notNull(),
    currency: text("currency").default("MXN").notNull(),
    status: text("status").default("PENDING").notNull(),
    statusDetail: text("statusDetail"),
    payerEmail: text("payerEmail"),
    payerId: text("payerId"),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    refundedAt: timestamp("refundedAt"),
    refundAmount: text("refundAmount"),
    paidAt: timestamp("paidAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("payments_tenantId_idx").on(table.tenantId),
    statusIdx: index("payments_status_idx").on(table.status),
    gatewayPaymentIdUnique: uniqueIndex("payments_gatewayPaymentId_unique").on(table.gatewayPaymentId),
  })
)

// Relations defined in relations.ts

// Type exports
export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
