import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { conversationStatusEnum } from "./enums"

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    configId: uuid("config_id").notNull(),

    // Agent reference (optional)
    agentId: uuid("agent_id"),

    // Client info
    phoneNumber: text("phone_number").notNull(),
    contactName: text("contact_name"),
    contactEmail: text("contact_email"),

    // Status
    status: conversationStatusEnum("status").default("ACTIVE").notNull(),

    lastMessageAt: timestamp("last_message_at"),
    messageCount: integer("message_count").default(0).notNull(),

    // OpenCode session
    opencodeSessionId: text("opencode_session_id"),

    // Metadata
    tags: text("tags").array().default([]).notNull(),
    duration: integer("duration"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantPhoneConfigUnique: uniqueIndex("conversations_tenant_id_phone_number_config_id_unique").on(
      table.tenantId,
      table.phoneNumber,
      table.configId
    ),
    agentIdIdx: index("conversations_agent_id_idx").on(table.agentId),
    statusIdx: index("conversations_status_idx").on(table.status),
    tenantIdIdx: index("conversations_tenant_id_idx").on(table.tenantId),
  })
)

// Relations defined in relations.ts

// Type exports
export type Conversation = typeof conversations.$inferSelect
export type NewConversation = typeof conversations.$inferInsert
