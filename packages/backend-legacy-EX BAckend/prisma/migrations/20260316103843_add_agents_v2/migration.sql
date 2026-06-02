-- Migration: add_agents_v2
-- Created: 2026-03-16

-- ============================================
-- STEP 1: Create new Enums
-- ============================================

CREATE TYPE "AgentType" AS ENUM ('MASTER', 'INTERNAL', 'EXTERNAL');

CREATE TYPE "AgentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TYPE "AgentAccessType" AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');

CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'PENDING_HUMAN', 'RESOLVED', 'CLOSED', 'ARCHIVED');

CREATE TYPE "MessageDirection" AS ENUM ('INCOMING', 'OUTGOING');

CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACTS', 'BUTTONS', 'LIST');

CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED');

CREATE TYPE "IntegrationType" AS ENUM ('CRM', 'ERP', 'ECOMMERCE', 'ACCOUNTING', 'BANK', 'CUSTOM_API', 'GOOGLE', 'MICROSOFT');

CREATE TYPE "IntegrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISABLED');

CREATE TYPE "KnowledgeType" AS ENUM ('FAQ', 'POLICY', 'DOCUMENT', 'PROCEDURE', 'PRODUCT', 'PRICING', 'OTHER');

-- ============================================
-- STEP 2: Create agents table
-- ============================================

CREATE TABLE "agents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "AgentType" NOT NULL DEFAULT 'INTERNAL',
    "status" "AgentStatus" NOT NULL DEFAULT 'DRAFT',
    "role" TEXT,
    "style" TEXT,
    "language" TEXT DEFAULT 'es',
    "systemPrompt" TEXT,
    "instructions" TEXT,
    "accessType" "AgentAccessType" NOT NULL DEFAULT 'PRIVATE',
    "workspaceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "blockedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 3: Create integrations table
-- ============================================

CREATE TABLE "integrations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IntegrationType" NOT NULL,
    "credentials" TEXT NOT NULL,
    "baseUrl" TEXT,
    "webhookUrl" TEXT,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 4: Create agent_integrations table
-- ============================================

CREATE TABLE "agent_integrations" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "integrationId" TEXT NOT NULL,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "config" JSONB,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_integrations_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 5: Create knowledge_entries table
-- ============================================

CREATE TABLE "knowledge_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT,
    "type" "KnowledgeType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("id")
);

-- ============================================
-- STEP 6: Add agentId to whatsapp_configs
-- ============================================

ALTER TABLE "whatsapp_configs" ADD COLUMN "agentId" TEXT;

-- Add greeting/away message columns
ALTER TABLE "whatsapp_configs" ADD COLUMN IF NOT EXISTS "greetingMessage" TEXT;
ALTER TABLE "whatsapp_configs" ADD COLUMN IF NOT EXISTS "awayMessage" TEXT;

-- ============================================
-- STEP 7: Add agentId to conversations
-- ============================================

ALTER TABLE "conversations" ADD COLUMN "agentId" TEXT;

-- Add new columns to conversations
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "messageCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "opencodeSessionId" TEXT;
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "duration" INTEGER;

-- ============================================
-- STEP 8: Convert Message columns to Enums
-- ============================================

-- First add new columns with enum type
ALTER TABLE "messages" ADD COLUMN "direction_new" "MessageDirection";
ALTER TABLE "messages" ADD COLUMN "type_new" "MessageType";
ALTER TABLE "messages" ADD COLUMN "status_new" "MessageStatus";

-- Migrate data from old columns to new columns
UPDATE "messages" SET
    "direction_new" = CASE
        WHEN "direction" = 'INCOMING' THEN 'INCOMING'::MessageDirection
        WHEN "direction" = 'OUTGOING' THEN 'OUTGOING'::MessageDirection
        ELSE 'INCOMING'::MessageDirection
    END,
    "type_new" = CASE
        WHEN "type" = 'text' THEN 'TEXT'::MessageType
        WHEN "type" = 'image' THEN 'IMAGE'::MessageType
        WHEN "type" = 'audio' THEN 'AUDIO'::MessageType
        WHEN "type" = 'video' THEN 'VIDEO'::MessageType
        WHEN "type" = 'document' THEN 'DOCUMENT'::MessageType
        WHEN "type" = 'location' THEN 'LOCATION'::MessageType
        WHEN "type" = 'contacts' THEN 'CONTACTS'::MessageType
        WHEN "type" = 'buttons' THEN 'BUTTONS'::MessageType
        WHEN "type" = 'list' THEN 'LIST'::MessageType
        ELSE 'TEXT'::MessageType
    END,
    "status_new" = CASE
        WHEN "status" = 'PENDING' THEN 'PENDING'::MessageStatus
        WHEN "status" = 'PROCESSING' THEN 'PROCESSING'::MessageStatus
        WHEN "status" = 'SENT' THEN 'SENT'::MessageStatus
        WHEN "status" = 'DELIVERED' THEN 'DELIVERED'::MessageStatus
        WHEN "status" = 'READ' THEN 'READ'::MessageStatus
        WHEN "status" = 'FAILED' THEN 'FAILED'::MessageStatus
        ELSE 'PENDING'::MessageStatus
    END;

-- Drop old columns
ALTER TABLE "messages" DROP COLUMN "direction";
ALTER TABLE "messages" DROP COLUMN "type";
ALTER TABLE "messages" DROP COLUMN "status";

-- Rename new columns
ALTER TABLE "messages" RENAME COLUMN "direction_new" TO "direction";
ALTER TABLE "messages" RENAME COLUMN "type_new" TO "type";
ALTER TABLE "messages" RENAME COLUMN "status_new" TO "status";

-- Add new columns to messages
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "inReplyTo" TEXT;
ALTER TABLE "messages" ALTER COLUMN "content" DROP NOT NULL;

-- Remove unused columns
ALTER TABLE "messages" DROP COLUMN IF EXISTS "fromPhone";
ALTER TABLE "messages" DROP COLUMN IF EXISTS "toPhone";

-- ============================================
-- STEP 9: Convert Conversation status to Enum
-- ============================================

ALTER TABLE "conversations" ADD COLUMN "status_new" "ConversationStatus";

UPDATE "conversations" SET
    "status_new" = CASE
        WHEN "status" = 'ACTIVE' THEN 'ACTIVE'::ConversationStatus
        WHEN "status" = 'PENDING_HUMAN' THEN 'PENDING_HUMAN'::ConversationStatus
        WHEN "status" = 'RESOLVED' THEN 'RESOLVED'::ConversationStatus
        WHEN "status" = 'CLOSED' THEN 'CLOSED'::ConversationStatus
        WHEN "status" = 'ARCHIVED' THEN 'ARCHIVED'::ConversationStatus
        ELSE 'ACTIVE'::ConversationStatus
    END;

ALTER TABLE "conversations" DROP COLUMN "status";
ALTER TABLE "conversations" RENAME COLUMN "status_new" TO "status";

-- ============================================
-- STEP 10: Create indexes
-- ============================================

-- Agents indexes
CREATE INDEX "agents_tenantId_idx" ON "agents"("tenantId");
CREATE INDEX "agents_type_idx" ON "agents"("type");
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- Integrations indexes
CREATE INDEX "integrations_tenantId_idx" ON "integrations"("tenantId");
CREATE UNIQUE INDEX "integrations_tenantId_name_key" ON "integrations"("tenantId", "name");

-- Agent integrations indexes
CREATE UNIQUE INDEX "agent_integrations_agentId_integrationId_key" ON "agent_integrations"("agentId", "integrationId");

-- Knowledge entries indexes
CREATE INDEX "knowledge_entries_tenantId_idx" ON "knowledge_entries"("tenantId");
CREATE INDEX "knowledge_entries_agentId_idx" ON "knowledge_entries"("agentId");
CREATE INDEX "knowledge_entries_type_idx" ON "knowledge_entries"("type");

-- WhatsApp configs indexes
CREATE INDEX "whatsapp_configs_agentId_idx" ON "whatsapp_configs"("agentId");

-- Conversations indexes
CREATE INDEX "conversations_agentId_idx" ON "conversations"("agentId");
CREATE INDEX "conversations_status_idx" ON "conversations"("status");

-- Messages indexes
CREATE INDEX "messages_direction_idx" ON "messages"("direction");

-- ============================================
-- STEP 11: Create foreign keys
-- ============================================

-- Agents -> Tenant
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Agents -> Agent (self)
ALTER TABLE "agents" ADD CONSTRAINT "agents_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Integrations -> Tenant
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentIntegrations -> Agent
ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AgentIntegrations -> Integration
ALTER TABLE "agent_integrations" ADD CONSTRAINT "agent_integrations_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "integrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- WhatsAppConfigs -> Agent
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Conversations -> Agent
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- STEP 12: Create Agents for existing WhatsAppConfigs
-- ============================================

-- Create an Agent for each existing WhatsAppConfig
INSERT INTO "agents" (
    "id",
    "tenantId",
    "name",
    "description",
    "type",
    "status",
    "role",
    "style",
    "language",
    "systemPrompt",
    "instructions",
    "accessType",
    "workspaceEnabled",
    "allowedTools",
    "blockedTools",
    "createdAt",
    "updatedAt"
)
SELECT
    gen_random_uuid()::TEXT,
    "tenantId",
    COALESCE("agentName", 'Agente WhatsApp'),
    'Agente creado automáticamente desde configuración de WhatsApp',
    'EXTERNAL'::AgentType,
    CASE WHEN "isDraft" THEN 'DRAFT'::AgentStatus ELSE 'ACTIVE'::AgentStatus END,
    "agentRole",
    "agentStyle",
    COALESCE("agentLanguage", 'es'),
    "agentInstructions",
    NULL,
    'SHARED'::AgentAccessType,
    false,
    "allowedTools",
    "blockedTools",
    "createdAt",
    "updatedAt"
FROM "whatsapp_configs";

-- Link WhatsAppConfigs with their created Agents
UPDATE "whatsapp_configs" wc
SET "agentId" = (
    SELECT a."id"
    FROM "agents" a
    WHERE a."tenantId" = wc."tenantId"
    AND a."name" = COALESCE(wc."agentName", 'Agente WhatsApp')
    ORDER BY a."createdAt" DESC
    LIMIT 1
)
WHERE wc."agentId" IS NULL;

-- Update Conversations to link with their Agent
UPDATE "conversations" c
SET "agentId" = (
    SELECT wc."agentId"
    FROM "whatsapp_configs" wc
    WHERE wc."id" = c."configId"
)
WHERE c."agentId" IS NULL;

-- ============================================
-- STEP 13: Update unique constraints
-- ============================================

-- Drop old unique constraint on conversations
ALTER TABLE "conversations" DROP CONSTRAINT IF EXISTS "conversations_tenantId_phoneNumber_key";

-- Add new unique constraint including configId
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_tenantId_phoneNumber_configId_key" UNIQUE ("tenantId", "phoneNumber", "configId");

-- Add unique constraint on whatsapp_configs
ALTER TABLE "whatsapp_configs" ADD CONSTRAINT "whatsapp_configs_tenantId_phoneNumberId_key" UNIQUE ("tenantId", "phoneNumberId");
