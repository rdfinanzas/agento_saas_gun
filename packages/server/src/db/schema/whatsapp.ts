import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  json,
  real,
} from "drizzle-orm/pg-core"
import { agentModeEnum, connectionTypeEnum } from "./enums"

export const whatsappConfigs = pgTable(
  "whatsapp_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    phoneNumberId: text("phone_number_id").notNull(),
    phoneNumber: text("phone_number"),
    accessToken: text("access_token").notNull(),
    webhookVerifyToken: text("webhook_verify_token").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    agentMode: agentModeEnum("agent_mode").default("LIMITED").notNull(),

    // Agent reference (optional)
    agentId: uuid("agent_id"),

    // Agent configuration (override from Agent)
    agentInstructions: text("agent_instructions"),
    knowledgeBase: json("knowledge_base").$type<Record<string, unknown>>(),
    agentLanguage: text("agent_language").default("es"),
    agentName: text("agent_name"),
    agentRole: text("agent_role"),
    agentStyle: text("agent_style"),

    // WhatsApp configuration
    greetingMessage: text("greeting_message"),
    awayMessage: text("away_message"),

    // Business config
    businessDescription: text("business_description"),
    businessHours: json("business_hours").$type<Record<string, unknown>>(),
    businessName: text("business_name"),
    businessPolicies: json("business_policies").$type<Record<string, unknown>>(),
    businessProcedures: json("business_procedures").$type<Record<string, unknown>>(),
    businessType: text("business_type"),
    faq: json("faq").$type<Record<string, unknown>[]>(),
    isDraft: boolean("is_draft").default(true).notNull(),
    allowedTools: text("allowed_tools").array().notNull(),
    blockedTools: text("blocked_tools").array().notNull(),
    requireApproval: boolean("require_approval").default(false).notNull(),
    approvalThreshold: real("approval_threshold"),
    approvalKeywords: text("approval_keywords").array().notNull(),
    baileysSession: text("baileys_session"),
    connectionStatus: text("connection_status").default("DISCONNECTED").notNull(),
    connectionType: connectionTypeEnum("connection_type").default("CLOUD_API").notNull(),

    // Evolution API / WAHA fields
    evolutionInstanceName: text("evolution_instance_name"),
    evolutionApiUrl: text("evolution_api_url"),
    evolutionApiKey: text("evolution_api_key"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    tenantPhoneUnique: uniqueIndex("whatsapp_configs_tenant_id_phone_number_id_unique").on(
      table.tenantId,
      table.phoneNumberId
    ),
    tenantIdIdx: index("whatsapp_configs_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("whatsapp_configs_agent_id_idx").on(table.agentId),
  })
)

// Relations defined in relations.ts

// Type exports
export type WhatsAppConfig = typeof whatsappConfigs.$inferSelect
export type NewWhatsAppConfig = typeof whatsappConfigs.$inferInsert
