/**
 * Agent Templates Schema
 * 
 * SP-11.1: Tabla para templates de agentes pre-configurados
 * 
 * Características:
 * - Templates globales (isPublic=true, tenantId=null)
 * - Templates por tenant (isPublic=false, tenantId=tenantId)
 * - Configuración completa de agente (system prompt, tools, skills)
 * - Variables para personalización
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  json,
  index,
} from "drizzle-orm/pg-core"

// Tipos de agente soportados
export const agentTypes = ["MASTER", "INTERNAL", "EXTERNAL"] as const
export type AgentTemplateType = typeof agentTypes[number]

// Variable de template para personalización
export type TemplateVariable = {
  name: string
  key: string
  type: "string" | "number" | "boolean" | "select" | "textarea"
  label: string
  description?: string
  default?: any
  required: boolean
  options?: { label: string; value: any }[] // Para type=select
}

// Configuración del template
export type AgentTemplateConfig = {
  // Prompts
  systemPrompt: string
  instructions?: string
  welcomeMessage?: string
  
  // Capacidades
  tools: string[] // Lista de tool names
  skills: string[] // Lista de skill IDs o nombres
  
  // Variables para personalización
  variables: TemplateVariable[]
  
  // Configuración adicional
  maxTokens?: number
  temperature?: number
  model?: string
  provider?: string
  
  // Metadata
  category?: string
  tags?: string[]
  difficulty?: "beginner" | "intermediate" | "advanced"
  estimatedSetupTime?: number // minutos
}

// Metadata del template
export type AgentTemplateMetadata = {
  author?: string
  authorEmail?: string
  version?: string
  downloads?: number
  rating?: number
  ratingCount?: number
  previewImage?: string
  documentationUrl?: string
  demoVideoUrl?: string
  changelog?: Array<{
    version: string
    date: string
    changes: string[]
  }>
}

export const agentTemplates = pgTable(
  "agent_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    
    // Null = template global/público
    tenantId: uuid("tenant_id"),
    
    // Identificación
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    shortDescription: text("short_description"), // Para listados
    
    // Tipo de agente
    type: text("type").notNull().$type<AgentTemplateType>(),
    
    // Configuración completa
    config: json("config").$type<AgentTemplateConfig>().notNull(),
    
    // Estado
    isActive: boolean("is_active").default(true).notNull(),
    isPublic: boolean("is_public").default(false).notNull(), // true = visible para todos los tenants
    isOfficial: boolean("is_official").default(false).notNull(), // true = creado por AgenTo
    
    // Metadatos
    metadata: json("metadata").$type<AgentTemplateMetadata>().default({}),
    
    // Timestamps
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    
    // Soft delete
    deletedAt: timestamp("deleted_at"),
  },
  (table) => ({
    tenantIdIdx: index("agent_templates_tenant_id_idx").on(table.tenantId),
    slugIdx: index("agent_templates_slug_idx").on(table.slug),
    typeIdx: index("agent_templates_type_idx").on(table.type),
    isPublicIdx: index("agent_templates_is_public_idx").on(table.isPublic),
    isActiveIdx: index("agent_templates_is_active_idx").on(table.isActive),
    tenantSlugIdx: index("agent_templates_tenant_slug_idx").on(table.tenantId, table.slug),
  })
)

// Instalaciones de templates por tenant
export const agentTemplateInstallations = pgTable(
  "agent_template_installations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    templateId: uuid("template_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    
    // Agente creado a partir del template
    agentId: uuid("agent_id"),
    
    // Variables usadas en la instalación
    variables: json("variables").$type<Record<string, any>>().default({}),
    
    // Estado
    status: text("status").default("active").notNull(), // active, paused, error
    
    // Timestamps
    installedAt: timestamp("installed_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => ({
    templateIdIdx: index("template_installations_template_id_idx").on(table.templateId),
    tenantIdIdx: index("template_installations_tenant_id_idx").on(table.tenantId),
    agentIdIdx: index("template_installations_agent_id_idx").on(table.agentId),
  })
)

// Type exports
export type AgentTemplate = typeof agentTemplates.$inferSelect
export type NewAgentTemplate = typeof agentTemplates.$inferInsert
export type AgentTemplateInstallation = typeof agentTemplateInstallations.$inferSelect
export type NewAgentTemplateInstallation = typeof agentTemplateInstallations.$inferInsert
