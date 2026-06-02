import {
  pgTable,
  uuid,
  text,
  bigint,
  timestamp,
  index,
  json,
} from "drizzle-orm/pg-core"
import { fileCategoryEnum } from "./enums"

export const tenantFiles = pgTable(
  "tenant_files",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    path: text("path").notNull(),
    mimeType: text("mime_type"),
    size: bigint("size", { mode: "bigint" }).notNull(),
    category: fileCategoryEnum("category").default("OTHER").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("tenant_files_tenant_id_idx").on(table.tenantId),
  })
)

// Relations defined in relations.ts

// Type exports
export type TenantFile = typeof tenantFiles.$inferSelect
export type NewTenantFile = typeof tenantFiles.$inferInsert
