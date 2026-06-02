import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"
import { messageDirectionEnum, messageTypeEnum, messageStatusEnum } from "./enums"

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    conversationId: uuid("conversation_id").notNull(),

    // Identification
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),

    // Direction and type
    direction: messageDirectionEnum("direction").notNull(),
    type: messageTypeEnum("type").default("TEXT").notNull(),
    content: text("content"),

    // Metadata
    metadata: json("metadata").$type<Record<string, unknown>>(),

    // Status
    status: messageStatusEnum("status").default("PENDING").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    conversationIdIdx: index("messages_conversation_id_idx").on(table.conversationId),
    tenantIdIdx: index("messages_tenant_id_idx").on(table.tenantId),
    directionIdx: index("messages_direction_idx").on(table.direction),
  })
)

// Relations defined in relations.ts

// Type exports
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
