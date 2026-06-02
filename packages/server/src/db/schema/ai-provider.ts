import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
  json,
} from "drizzle-orm/pg-core"

export const aiProviders = pgTable(
  "ai_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider").notNull().unique(),
    displayName: text("displayName").notNull(),
    description: text("description"),
    isActive: boolean("isActive").default(true).notNull(),
    isDefault: boolean("isDefault").default(false).notNull(),
    apiKeyName: text("apiKeyName").notNull(),
    configSchema: json("configSchema").$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    isActiveIdx: index("ai_providers_is_active_idx").on(table.isActive),
    providerUnique: uniqueIndex("ai_providers_provider_unique").on(table.provider),
  })
)

export const aiModels = pgTable(
  "ai_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    providerId: uuid("providerId").notNull().references(() => aiProviders.id, { onDelete: "cascade" }),
    modelId: text("modelId").notNull(),
    displayName: text("displayName").notNull(),
    description: text("description"),
    isActive: boolean("isActive").default(true).notNull(),
    maxTokens: text("maxTokens"),
    supportsVision: boolean("supportsVision").default(false).notNull(),
    supportsTools: boolean("supportsTools").default(true).notNull(),
    supportsStreaming: boolean("supportsStreaming").default(true).notNull(),
    costPer1kTokens: text("costPer1kTokens"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().notNull(),
  },
  (table) => ({
    providerModelUnique: uniqueIndex("ai_models_provider_id_model_id_unique").on(table.providerId, table.modelId),
    isActiveIdx: index("ai_models_is_active_idx").on(table.isActive),
  })
)

// Type exports
export type AIProvider = typeof aiProviders.$inferSelect
export type NewAIProvider = typeof aiProviders.$inferInsert
export type AIModel = typeof aiModels.$inferSelect
export type NewAIModel = typeof aiModels.$inferInsert
