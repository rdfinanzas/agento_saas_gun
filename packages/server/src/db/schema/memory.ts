import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
  json,
} from "drizzle-orm/pg-core"
import { contextTypeEnum } from "./enums"

export const conversationContexts = pgTable(
  "conversation_contexts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    type: contextTypeEnum("type").default("CHAT").notNull(),
    messages: json("messages").$type<unknown[]>().default([]).notNull(),
    memory: json("memory").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantTypeUnique: uniqueIndex("conversation_contexts_tenant_id_type_unique").on(table.tenantId, table.type),
  })
)

export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    contextId: uuid("context_id").notNull(),
    agentId: uuid("agent_id"),
    key: text("key").notNull(),
    value: json("value").$type<unknown>().notNull(),
    category: text("category"),
    ttl: timestamp("ttl"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantContextKeyUnique: uniqueIndex("memory_entries_tenant_id_context_id_key_unique").on(
      table.tenantId,
      table.contextId,
      table.key
    ),
    tenantIdIdx: index("memory_entries_tenant_id_idx").on(table.tenantId),
    tenantContextIdIdx: index("memory_entries_tenant_id_context_id_idx").on(table.tenantId, table.contextId),
    tenantAgentIdIdx: index("memory_entries_tenant_id_agent_id_idx").on(table.tenantId, table.agentId),
    categoryIdx: index("memory_entries_category_idx").on(table.category),
  })
)

// Relations defined in relations.ts

// Type exports
export type ConversationContext = typeof conversationContexts.$inferSelect
export type NewConversationContext = typeof conversationContexts.$inferInsert
export type MemoryEntry = typeof memoryEntries.$inferSelect
export type NewMemoryEntry = typeof memoryEntries.$inferInsert
