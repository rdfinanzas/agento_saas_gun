/**
 * AI Configuration Schema
 *
 * Gestiona la configuración global de AI y permisos por tenant
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core"

// ============================================
// CONFIGURACIÓN GLOBAL DE IA
// ============================================

export const aiGlobalConfig = pgTable(
  "ai_global_config",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // Proveedor/modelo DEFAULT global para todo el sistema
    defaultProvider: text("default_provider").notNull(),
    defaultModel: text("default_model").notNull(),

    // Si los tenants pueden o no usar sus propios modelos
    // false = solo el admin puede configurar, todos usan el default
    // true = tenants autorizados pueden configurar su propio modelo
    allowTenantModels: boolean("allow_tenant_models").default(false).notNull(),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    idIdx: index("ai_global_config_id_idx").on(table.id),
  })
)

// ============================================
// AUTORIZACIONES DE TENANTS
// ============================================

export const aiTenantPermissions = pgTable(
  "ai_tenant_permissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    tenantId: uuid("tenant_id").notNull(),

    // Si este tenant está autorizado a configurar su propio modelo
    canUseOwnModel: boolean("can_use_own_model").default(false).notNull(),

    // Si este tenant tiene su propio modelo configurado
    hasOwnModel: boolean("has_own_model").default(false).notNull(),

    // Proveedor/modelo propio del tenant (si está autorizado y configurado)
    ownProvider: text("own_provider"),
    ownModel: text("own_model"),

    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantIdIdx: index("ai_tenant_permissions_tenant_id_idx").on(table.tenantId),
    canUseOwnModelIdx: index("ai_tenant_permissions_can_use_own_model_idx").on(table.canUseOwnModel),
  })
)

// Type exports
export type AIGlobalConfig = typeof aiGlobalConfig.$inferSelect
export type NewAIGlobalConfig = typeof aiGlobalConfig.$inferInsert
export type AITenantPermission = typeof aiTenantPermissions.$inferSelect
export type NewAITenantPermission = typeof aiTenantPermissions.$inferInsert
