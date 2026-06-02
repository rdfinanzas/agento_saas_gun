import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  json,
  decimal,
} from "drizzle-orm/pg-core"

export const marketplaceSkills = pgTable(
  "marketplace_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    author: text("author").notNull(),
    authorId: text("author_id").notNull(),
    version: text("version").default("1.0.0").notNull(),
    content: text("content").notNull(),
    command: text("command"),
    tags: text("tags").array().notNull(),
    status: text("status").default("PUBLISHED").notNull(),
    downloads: integer("downloads").default(0).notNull(),
    rating: decimal("rating", { precision: 3, scale: 2 }).default("0").notNull(),
    ratingsCount: integer("ratings_count").default(0).notNull(),
    isVerified: boolean("is_verified").default(false).notNull(),
    isOfficial: boolean("is_official").default(false).notNull(),
    compatibility: text("compatibility").array().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    categoryIdx: index("marketplace_skills_category_idx").on(table.category),
    authorIdIdx: index("marketplace_skills_author_id_idx").on(table.authorId),
    statusIdx: index("marketplace_skills_status_idx").on(table.status),
  })
)

export const skillReviews = pgTable(
  "skill_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    skillId: uuid("skill_id").notNull().references(() => marketplaceSkills.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    userName: text("user_name").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    skillUserUnique: uniqueIndex("skill_reviews_skill_id_user_id_unique").on(table.skillId, table.userId),
    skillIdIdx: index("skill_reviews_skill_id_idx").on(table.skillId),
  })
)

export const installedSkills = pgTable(
  "installed_skills",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenantId").notNull(),
    marketplaceSkillId: uuid("marketplaceSkillId").notNull().references(() => marketplaceSkills.id, { onDelete: "cascade" }),
    localSkillId: text("localSkillId").notNull(),
    installedVersion: text("installedVersion").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => ({
    tenantSkillUnique: uniqueIndex("installed_skills_tenantId_marketplaceSkillId_unique").on(
      table.tenantId,
      table.marketplaceSkillId
    ),
    tenantIdIdx: index("installed_skills_tenantId_idx").on(table.tenantId),
  })
)

// Relations defined in relations.ts

// Type exports
export type MarketplaceSkill = typeof marketplaceSkills.$inferSelect
export type NewMarketplaceSkill = typeof marketplaceSkills.$inferInsert
export type SkillReview = typeof skillReviews.$inferSelect
export type NewSkillReview = typeof skillReviews.$inferInsert
export type InstalledSkill = typeof installedSkills.$inferSelect
export type NewInstalledSkill = typeof installedSkills.$inferInsert
