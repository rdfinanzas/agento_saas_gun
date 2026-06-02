import {
  pgTable,
  text,
  uuid,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core"

export const dunningAttempts = pgTable(
  "dunning_attempts",
  {
    id: text("id").primaryKey(),
    subscriptionId: uuid("subscription_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    attemptedAt: timestamp("attempted_at").defaultNow().notNull(),
    nextRetryAt: timestamp("next_retry_at"),
  },
  (table) => ({
    subscriptionIdIdx: index("dunning_attempts_subscription_id_idx").on(table.subscriptionId),
    statusIdx: index("dunning_attempts_status_idx").on(table.status),
  })
)

// Relations defined in relations.ts

// Type exports
export type DunningAttempt = typeof dunningAttempts.$inferSelect
export type NewDunningAttempt = typeof dunningAttempts.$inferInsert
