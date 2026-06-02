import { pgEnum } from "drizzle-orm/pg-core"

// Subscription Tiers
export const subscriptionTierEnum = pgEnum("subscription_tier", [
  "FREE",
  "PRO",
  "ENTERPRISE",
])

// Subscription Tier constant for runtime use
export const SubscriptionTier = {
  FREE: "FREE",
  PRO: "PRO",
  ENTERPRISE: "ENTERPRISE",
} as const

// Tenant Roles
export const tenantRoleEnum = pgEnum("tenant_role", [
  "OWNER",
  "ADMIN",
  "MEMBER",
])

// File Categories
export const fileCategoryEnum = pgEnum("file_category", [
  "DOCUMENT",
  "SPREADSHEET",
  "IMAGE",
  "ARCHIVE",
  "OTHER",
  "GOOGLE_SHEET",
])

// Context Types
export const contextTypeEnum = pgEnum("context_type", [
  "CHAT",
  "WHATSAPP_AGENT",
  "WORKSPACE",
])

// Agent Modes
export const agentModeEnum = pgEnum("agent_mode", [
  "FULL",
  "LIMITED",
])

// Connection Types
export const connectionTypeEnum = pgEnum("connection_type", [
  "CLOUD_API",
  "BAILEYS",
  "EVOLUTION_API",
])

// Subscription Status
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "PENDING",
  "ACTIVE",
  "PAUSED",
  "PAST_DUE",
  "CANCELLED",
  "EXPIRED",
])

// Subscription Status constant for runtime use
export const SubscriptionStatusValue = {
  PENDING: "PENDING",
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
  PAST_DUE: "PAST_DUE",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const

// Alias for backward compatibility
export const SubscriptionStatus = SubscriptionStatusValue

// Payment Status
export const paymentStatusEnum = pgEnum("payment_status", [
  "PENDING",
  "APPROVED",
  "AUTHORIZED",
  "IN_PROCESS",
  "REJECTED",
  "CANCELLED",
  "REFUNDED",
  "CHARGED_BACK",
])

// Invoice Status
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "DRAFT",
  "OPEN",
  "PAID",
  "VOID",
  "UNCOLLECTIBLE",
])

// Task Status
export const taskStatusEnum = pgEnum("task_status", [
  "QUEUED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
])

// File Types
export const fileTypeEnum = pgEnum("file_type", [
  "USER",
  "TASK",
  "TEMP",
])

// Agent Types (V2)
export const agentTypeEnum = pgEnum("agent_type", [
  "MASTER",
  "INTERNAL",
  "EXTERNAL",
])

// Agent Status (V2)
export const agentStatusEnum = pgEnum("agent_status", [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "ARCHIVED",
])

// Agent Access Types (V2)
export const agentAccessTypeEnum = pgEnum("agent_access_type", [
  "PRIVATE",
  "SHARED",
  "PUBLIC",
])

// Conversation Status (V2)
export const conversationStatusEnum = pgEnum("conversation_status", [
  "ACTIVE",
  "PENDING_HUMAN",
  "RESOLVED",
  "CLOSED",
  "ARCHIVED",
])

// Message Direction (V2)
export const messageDirectionEnum = pgEnum("message_direction", [
  "INCOMING",
  "OUTGOING",
])

// Message Types (V2)
export const messageTypeEnum = pgEnum("message_type", [
  "TEXT",
  "IMAGE",
  "AUDIO",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
  "CONTACTS",
  "BUTTONS",
  "LIST",
])

// Message Status (V2)
export const messageStatusEnum = pgEnum("message_status", [
  "PENDING",
  "PROCESSING",
  "SENT",
  "DELIVERED",
  "READ",
  "FAILED",
])

// Integration Types
export const integrationTypeEnum = pgEnum("integration_type", [
  "CRM",
  "ERP",
  "ECOMMERCE",
  "ACCOUNTING",
  "BANK",
  "CUSTOM_API",
  "GOOGLE",
  "MICROSOFT",
])

// Integration Status
export const integrationStatusEnum = pgEnum("integration_status", [
  "PENDING",
  "ACTIVE",
  "ERROR",
  "DISABLED",
])

// Knowledge Types
export const knowledgeTypeEnum = pgEnum("knowledge_type", [
  "FAQ",
  "POLICY",
  "DOCUMENT",
  "PROCEDURE",
  "PRODUCT",
  "PRICING",
  "OTHER",
])

// Type exports for TypeScript
export type SubscriptionTier = typeof SubscriptionTier[keyof typeof SubscriptionTier]
export type TenantRole = (typeof tenantRoleEnum.enumValues)[number]
export type FileCategory = (typeof fileCategoryEnum.enumValues)[number]
export type ContextType = (typeof contextTypeEnum.enumValues)[number]
export type AgentMode = (typeof agentModeEnum.enumValues)[number]
export type ConnectionType = (typeof connectionTypeEnum.enumValues)[number]
export type SubscriptionStatus = typeof SubscriptionStatus[keyof typeof SubscriptionStatus]
export type PaymentStatus = (typeof paymentStatusEnum.enumValues)[number]
export type InvoiceStatus = (typeof invoiceStatusEnum.enumValues)[number]
export type TaskStatus = (typeof taskStatusEnum.enumValues)[number]
export type FileType = (typeof fileTypeEnum.enumValues)[number]
export type AgentType = (typeof agentTypeEnum.enumValues)[number]
export type AgentStatus = (typeof agentStatusEnum.enumValues)[number]
export type AgentAccessType = (typeof agentAccessTypeEnum.enumValues)[number]
export type ConversationStatus = (typeof conversationStatusEnum.enumValues)[number]
export type MessageDirection = (typeof messageDirectionEnum.enumValues)[number]
export type MessageType = (typeof messageTypeEnum.enumValues)[number]
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number]
export type IntegrationType = (typeof integrationTypeEnum.enumValues)[number]
export type IntegrationStatus = (typeof integrationStatusEnum.enumValues)[number]
export type KnowledgeType = (typeof knowledgeTypeEnum.enumValues)[number]
