import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  json,
  text as textCol,
} from "drizzle-orm/pg-core"
import { knowledgeTypeEnum } from "./enums"

export const knowledgeEntries = pgTable(
  "knowledge_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    agentId: uuid("agent_id"), // Null = global tenant

    // Content
    type: knowledgeTypeEnum("type").notNull(),
    title: text("title").notNull(),
    content: textCol("content").notNull(),
    source: text("source"),

    // Metadata
    tags: text("tags").array().default([]).notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),

    // Status
    status: text("status").default("ACTIVE").notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("knowledge_entries_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("knowledge_entries_agent_id_idx").on(table.agentId),
    typeIdx: index("knowledge_entries_type_idx").on(table.type),
  })
)

export const knowledgeEmbeddings = pgTable(
  "knowledge_embeddings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    content: text("content").notNull(),
    embedding: text("embedding").notNull(), // Vector stored as string
    source: text("source").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("knowledge_embeddings_tenant_id_idx").on(table.tenantId),
    tenantSourceIdx: index("knowledge_embeddings_tenant_id_source_idx").on(table.tenantId, table.source),
  })
)

// Type exports
export type KnowledgeEntry = typeof knowledgeEntries.$inferSelect
export type NewKnowledgeEntry = typeof knowledgeEntries.$inferInsert
export type KnowledgeEmbedding = typeof knowledgeEmbeddings.$inferSelect
export type NewKnowledgeEmbedding = typeof knowledgeEmbeddings.$inferInsert
