import {
  pgTable,
  text,
  boolean,
  real,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"

export const coupons = pgTable(
  "coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    description: text("description"),
    discountType: text("discount_type").notNull(),
    discountValue: real("discount_value").notNull(),
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").default(0).notNull(),
    validFrom: timestamp("valid_from").notNull(),
    validUntil: timestamp("valid_until").notNull(),
    active: boolean("active").default(true).notNull(),
    planIds: text("plan_ids"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    codeIdx: index("coupons_code_idx").on(table.code),
    activeIdx: index("coupons_active_idx").on(table.active),
    codeUnique: uniqueIndex("coupons_code_unique").on(table.code),
  })
)

// Relations defined in relations.ts

// Type exports
export type Coupon = typeof coupons.$inferSelect
export type NewCoupon = typeof coupons.$inferInsert
