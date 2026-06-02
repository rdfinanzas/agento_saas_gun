-- ============================================================================
-- AgenTo SaaS - Complete PostgreSQL CREATE TABLE Script
-- Generated from Drizzle ORM schema definitions
-- ============================================================================
-- Execution order respects foreign key dependencies.
-- Run this script against a PostgreSQL database (13+ recommended for gen_random_uuid).
-- ============================================================================

-- Enable pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES (PostgreSQL ENUMs matching Drizzle pgEnum definitions)
-- ============================================================================

CREATE TYPE subscription_tier AS ENUM ('FREE', 'PRO', 'ENTERPRISE');
CREATE TYPE tenant_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE file_category AS ENUM ('DOCUMENT', 'SPREADSHEET', 'IMAGE', 'ARCHIVE', 'OTHER', 'GOOGLE_SHEET');
CREATE TYPE context_type AS ENUM ('CHAT', 'WHATSAPP_AGENT', 'WORKSPACE');
CREATE TYPE agent_mode AS ENUM ('FULL', 'LIMITED');
CREATE TYPE connection_type AS ENUM ('CLOUD_API', 'BAILEYS', 'EVOLUTION_API');
CREATE TYPE subscription_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED', 'EXPIRED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'APPROVED', 'AUTHORIZED', 'IN_PROCESS', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');
CREATE TYPE task_status AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
CREATE TYPE file_type AS ENUM ('USER', 'TASK', 'TEMP');
CREATE TYPE agent_type AS ENUM ('MASTER', 'INTERNAL', 'EXTERNAL');
CREATE TYPE agent_status AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE agent_access_type AS ENUM ('PRIVATE', 'SHARED', 'PUBLIC');
CREATE TYPE conversation_status AS ENUM ('ACTIVE', 'PENDING_HUMAN', 'RESOLVED', 'CLOSED', 'ARCHIVED');
CREATE TYPE message_direction AS ENUM ('INCOMING', 'OUTGOING');
CREATE TYPE message_type AS ENUM ('TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'DOCUMENT', 'LOCATION', 'CONTACTS', 'BUTTONS', 'LIST');
CREATE TYPE message_status AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE integration_type AS ENUM ('CRM', 'ERP', 'ECOMMERCE', 'ACCOUNTING', 'BANK', 'CUSTOM_API', 'GOOGLE', 'MICROSOFT');
CREATE TYPE integration_status AS ENUM ('PENDING', 'ACTIVE', 'ERROR', 'DISABLED');
CREATE TYPE knowledge_type AS ENUM ('FAQ', 'POLICY', 'DOCUMENT', 'PROCEDURE', 'PRODUCT', 'PRICING', 'OTHER');

-- ============================================================================
-- LAYER 0: Tables with no foreign key dependencies (root tables)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    passwordhash TEXT NOT NULL,
    name TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- plans
-- ----------------------------------------------------------------------------
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier subscription_tier NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    price_monthly REAL NOT NULL DEFAULT 0,
    price_yearly REAL,
    currency TEXT NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    features JSON NOT NULL DEFAULT '[]',
    limits JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX plans_is_active_idx ON plans (is_active);
CREATE INDEX plans_tier_idx ON plans (tier);
CREATE UNIQUE INDEX plans_tier_unique ON plans (tier);

-- ----------------------------------------------------------------------------
-- coupons
-- ----------------------------------------------------------------------------
CREATE TABLE coupons (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    description TEXT,
    discount_type TEXT NOT NULL,
    discount_value REAL NOT NULL,
    max_uses INTEGER,
    used_count INTEGER NOT NULL DEFAULT 0,
    valid_from TIMESTAMP NOT NULL,
    valid_until TIMESTAMP NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    plan_ids TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX coupons_code_idx ON coupons (code);
CREATE INDEX coupons_active_idx ON coupons (active);
CREATE UNIQUE INDEX coupons_code_unique ON coupons (code);

-- ----------------------------------------------------------------------------
-- ai_global_config
-- ----------------------------------------------------------------------------
CREATE TABLE ai_global_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    default_provider TEXT NOT NULL,
    default_model TEXT NOT NULL,
    allow_tenant_models BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_global_config_id_idx ON ai_global_config (id);

-- ----------------------------------------------------------------------------
-- ai_providers
-- ----------------------------------------------------------------------------
CREATE TABLE ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,
    "displayName" TEXT NOT NULL,
    description TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "apiKeyName" TEXT NOT NULL,
    "configSchema" JSON NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_providers_is_active_idx ON ai_providers ("isActive");
CREATE UNIQUE INDEX ai_providers_provider_unique ON ai_providers (provider);

-- ----------------------------------------------------------------------------
-- marketplace_skills
-- ----------------------------------------------------------------------------
CREATE TABLE marketplace_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0.0',
    content TEXT NOT NULL,
    command TEXT,
    tags TEXT[] NOT NULL,
    status TEXT NOT NULL DEFAULT 'PUBLISHED',
    downloads INTEGER NOT NULL DEFAULT 0,
    rating DECIMAL(3,2) NOT NULL DEFAULT '0',
    ratings_count INTEGER NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_official BOOLEAN NOT NULL DEFAULT false,
    compatibility TEXT[] NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX marketplace_skills_category_idx ON marketplace_skills (category);
CREATE INDEX marketplace_skills_author_id_idx ON marketplace_skills (author_id);
CREATE INDEX marketplace_skills_status_idx ON marketplace_skills (status);

-- ============================================================================
-- LAYER 1: Tables depending on Layer 0
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tenants  (depends on plans)
-- ----------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    "subscriptionTier" subscription_tier NOT NULL DEFAULT 'FREE',
    "quotaMaxRequests" INTEGER NOT NULL DEFAULT 1000,
    "quotaMaxStorage" BIGINT NOT NULL DEFAULT 1073741824,
    settings JSON,
    integrations JSON NOT NULL DEFAULT '{}',
    "planId" UUID REFERENCES plans(id) ON DELETE SET NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX tenants_subscription_tier_idx ON tenants ("subscriptionTier");
CREATE INDEX tenants_plan_id_idx ON tenants ("planId");
CREATE UNIQUE INDEX tenants_slug_unique ON tenants (slug);
CREATE UNIQUE INDEX tenants_email_unique ON tenants (email);

-- ----------------------------------------------------------------------------
-- ai_models  (depends on ai_providers)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "providerId" UUID NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
    "modelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    description TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "maxTokens" TEXT,
    "supportsVision" BOOLEAN NOT NULL DEFAULT false,
    "supportsTools" BOOLEAN NOT NULL DEFAULT true,
    "supportsStreaming" BOOLEAN NOT NULL DEFAULT true,
    "costPer1kTokens" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX ai_models_provider_id_model_id_unique ON ai_models ("providerId", "modelId");
CREATE INDEX ai_models_is_active_idx ON ai_models ("isActive");

-- ----------------------------------------------------------------------------
-- skill_reviews  (depends on marketplace_skills)
-- ----------------------------------------------------------------------------
CREATE TABLE skill_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    skill_id UUID NOT NULL REFERENCES marketplace_skills(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX skill_reviews_skill_id_user_id_unique ON skill_reviews (skill_id, user_id);
CREATE INDEX skill_reviews_skill_id_idx ON skill_reviews (skill_id);

-- ============================================================================
-- LAYER 2: Tables depending on Layer 1 (tenants, users)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- tenant_users  (depends on tenants, users)
-- ----------------------------------------------------------------------------
CREATE TABLE tenant_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role tenant_role NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX tenant_users_tenant_id_user_id_unique ON tenant_users ("tenantId", "userId");
CREATE INDEX tenant_users_tenant_id_idx ON tenant_users ("tenantId");

-- ----------------------------------------------------------------------------
-- ai_tenant_permissions  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE ai_tenant_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    can_use_own_model BOOLEAN NOT NULL DEFAULT false,
    has_own_model BOOLEAN NOT NULL DEFAULT false,
    own_provider TEXT,
    own_model TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX ai_tenant_permissions_tenant_id_idx ON ai_tenant_permissions (tenant_id);
CREATE INDEX ai_tenant_permissions_can_use_own_model_idx ON ai_tenant_permissions (can_use_own_model);

-- ----------------------------------------------------------------------------
-- subscriptions  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL UNIQUE,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    tier subscription_tier NOT NULL DEFAULT 'FREE',
    status subscription_status NOT NULL DEFAULT 'PENDING',
    "cancelAtPeriodEnd" TEXT NOT NULL DEFAULT 'false',
    "cancelledAt" TIMESTAMP,
    "pausedAt" TIMESTAMP,
    "currentPeriodStart" TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP,
    gateway TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "gatewayCustomerId" TEXT,
    "gatewayPreapprovalId" TEXT,
    "autoRenew" TEXT NOT NULL DEFAULT 'true',
    "trialEnd" TIMESTAMP,
    "prorationCredit" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX subscriptions_tenantId_idx ON subscriptions ("tenantId");
CREATE INDEX subscriptions_status_idx ON subscriptions (status);
CREATE INDEX subscriptions_gatewayPreapprovalId_idx ON subscriptions ("gatewayPreapprovalId");
CREATE UNIQUE INDEX subscriptions_tenantId_unique ON subscriptions ("tenantId");

-- ----------------------------------------------------------------------------
-- payments  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    gateway TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "gatewayPaymentId" TEXT NOT NULL UNIQUE,
    amount TEXT NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN',
    status TEXT NOT NULL DEFAULT 'PENDING',
    "statusDetail" TEXT,
    "payerEmail" TEXT,
    "payerId" TEXT,
    metadata JSON,
    "refundedAt" TIMESTAMP,
    "refundAmount" TEXT,
    "paidAt" TIMESTAMP,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX payments_tenantId_idx ON payments ("tenantId");
CREATE INDEX payments_status_idx ON payments (status);
CREATE UNIQUE INDEX payments_gatewayPaymentId_unique ON payments ("gatewayPaymentId");

-- ----------------------------------------------------------------------------
-- invoices  (depends on tenants, subscriptions, coupons)
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    subscription_id UUID NOT NULL,
    number TEXT NOT NULL UNIQUE,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'MXN',
    tax REAL,
    discount REAL,
    coupon_id TEXT REFERENCES coupons(id) ON DELETE SET NULL,
    status invoice_status NOT NULL DEFAULT 'OPEN',
    payment_method TEXT,
    payment_reference TEXT,
    paid_at TIMESTAMP,
    due_date TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX invoices_tenant_id_idx ON invoices (tenant_id);
CREATE INDEX invoices_status_idx ON invoices (status);
CREATE UNIQUE INDEX invoices_number_unique ON invoices (number);

-- ----------------------------------------------------------------------------
-- dunning_attempts  (depends on subscriptions)
-- ----------------------------------------------------------------------------
CREATE TABLE dunning_attempts (
    id TEXT PRIMARY KEY,
    subscription_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    attempted_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMP
);
CREATE INDEX dunning_attempts_subscription_id_idx ON dunning_attempts (subscription_id);
CREATE INDEX dunning_attempts_status_idx ON dunning_attempts (status);

-- ----------------------------------------------------------------------------
-- agents  (depends on tenants, self-referencing for parentId)
-- ----------------------------------------------------------------------------
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type agent_type NOT NULL DEFAULT 'INTERNAL',
    status agent_status NOT NULL DEFAULT 'DRAFT',
    role TEXT,
    style TEXT,
    language TEXT DEFAULT 'es',
    system_prompt TEXT,
    instructions TEXT,
    access_type agent_access_type NOT NULL DEFAULT 'PRIVATE',
    workspace_enabled BOOLEAN NOT NULL DEFAULT false,
    allowed_tools TEXT[] NOT NULL DEFAULT '{}',
    blocked_tools TEXT[] NOT NULL DEFAULT '{}',
    parent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX agents_tenant_id_idx ON agents (tenant_id);
CREATE INDEX agents_type_idx ON agents (type);
CREATE INDEX agents_status_idx ON agents (status);
CREATE INDEX agents_parent_id_idx ON agents (parent_id);

-- ----------------------------------------------------------------------------
-- workspaces  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL UNIQUE,
    path TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX workspaces_tenant_id_idx ON workspaces (tenant_id);
CREATE INDEX workspaces_is_active_idx ON workspaces (is_active);

-- ----------------------------------------------------------------------------
-- tenant_usages  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE tenant_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    requests_count INTEGER NOT NULL DEFAULT 0,
    whatsapp_messages INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX tenant_usages_tenant_id_date_unique ON tenant_usages (tenant_id, date);

-- ----------------------------------------------------------------------------
-- tenant_files  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE tenant_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size BIGINT NOT NULL,
    category file_category NOT NULL DEFAULT 'OTHER',
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX tenant_files_tenant_id_idx ON tenant_files (tenant_id);

-- ----------------------------------------------------------------------------
-- conversation_contexts  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE conversation_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    type context_type NOT NULL DEFAULT 'CHAT',
    messages JSON NOT NULL DEFAULT '[]',
    memory JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX conversation_contexts_tenant_id_type_unique ON conversation_contexts (tenant_id, type);

-- ----------------------------------------------------------------------------
-- integrations  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    type integration_type NOT NULL,
    credentials TEXT NOT NULL,
    base_url TEXT,
    webhook_url TEXT,
    status integration_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX integrations_tenant_id_name_unique ON integrations (tenant_id, name);
CREATE INDEX integrations_tenant_id_idx ON integrations (tenant_id);

-- ----------------------------------------------------------------------------
-- api_connectors  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE api_connectors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    base_url TEXT NOT NULL,
    auth_type TEXT NOT NULL DEFAULT 'none',
    auth_config JSON NOT NULL DEFAULT '{}',
    tools JSON NOT NULL DEFAULT '[]',
    raw_documentation JSON,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX api_connectors_tenant_id_idx ON api_connectors (tenant_id);
CREATE INDEX api_connectors_is_active_idx ON api_connectors (is_active);

-- ----------------------------------------------------------------------------
-- db_credentials  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE db_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL,
    host TEXT NOT NULL,
    port TEXT NOT NULL,
    database TEXT NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    connection_string TEXT,
    config JSON,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_test_at TIMESTAMP,
    last_test_status TEXT,
    last_test_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX db_credentials_tenant_id_idx ON db_credentials (tenant_id);
CREATE INDEX db_credentials_type_idx ON db_credentials (type);
CREATE INDEX db_credentials_is_active_idx ON db_credentials (is_active);
CREATE INDEX db_credentials_name_idx ON db_credentials (name);

-- ----------------------------------------------------------------------------
-- accomplish_tasks  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE accomplish_tasks (
    id TEXT PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    prompt TEXT NOT NULL,
    status task_status NOT NULL DEFAULT 'QUEUED',
    "sessionId" TEXT,
    messages JSONB NOT NULL DEFAULT '[]',
    result JSONB,
    error TEXT,
    "workspacePath" TEXT,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
    "startedAt" TIMESTAMP,
    "completedAt" TIMESTAMP
);
CREATE INDEX accomplish_tasks_tenant_id_idx ON accomplish_tasks ("tenantId");
CREATE INDEX accomplish_tasks_user_id_idx ON accomplish_tasks ("userId");
CREATE INDEX accomplish_tasks_status_idx ON accomplish_tasks (status);
CREATE INDEX accomplish_tasks_session_id_idx ON accomplish_tasks ("sessionId");
CREATE INDEX accomplish_tasks_created_at_idx ON accomplish_tasks ("createdAt");

-- ============================================================================
-- LAYER 3: Tables depending on Layer 2 (agents, etc.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- whatsapp_configs  (depends on tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE whatsapp_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    phone_number_id TEXT NOT NULL,
    phone_number TEXT,
    access_token TEXT NOT NULL,
    webhook_verify_token TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    agent_mode agent_mode NOT NULL DEFAULT 'LIMITED',
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    agent_instructions TEXT,
    knowledge_base JSON,
    agent_language TEXT DEFAULT 'es',
    agent_name TEXT,
    agent_role TEXT,
    agent_style TEXT,
    greeting_message TEXT,
    away_message TEXT,
    business_description TEXT,
    business_hours JSON,
    business_name TEXT,
    business_policies JSON,
    business_procedures JSON,
    business_type TEXT,
    faq JSON,
    is_draft BOOLEAN NOT NULL DEFAULT true,
    allowed_tools TEXT[] NOT NULL,
    blocked_tools TEXT[] NOT NULL,
    require_approval BOOLEAN NOT NULL DEFAULT false,
    approval_threshold REAL,
    approval_keywords TEXT[] NOT NULL,
    baileys_session TEXT,
    connection_status TEXT NOT NULL DEFAULT 'DISCONNECTED',
    connection_type connection_type NOT NULL DEFAULT 'CLOUD_API',
    evolution_instance_name TEXT,
    evolution_api_url TEXT,
    evolution_api_key TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX whatsapp_configs_tenant_id_phone_number_id_unique ON whatsapp_configs (tenant_id, phone_number_id);
CREATE INDEX whatsapp_configs_tenant_id_idx ON whatsapp_configs (tenant_id);
CREATE INDEX whatsapp_configs_agent_id_idx ON whatsapp_configs (agent_id);

-- ----------------------------------------------------------------------------
-- skills  (depends on tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    instructions TEXT NOT NULL,
    tools TEXT[] NOT NULL DEFAULT '{}',
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX skills_tenant_id_idx ON skills (tenant_id);
CREATE INDEX skills_agent_id_idx ON skills (agent_id);
CREATE INDEX skills_is_system_idx ON skills (is_system);

-- ----------------------------------------------------------------------------
-- tools  (depends on tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    parameters JSON NOT NULL,
    can_execute_code BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX tools_tenant_id_idx ON tools (tenant_id);
CREATE INDEX tools_agent_id_idx ON tools (agent_id);
CREATE INDEX tools_is_system_idx ON tools (is_system);
CREATE INDEX tools_can_execute_code_idx ON tools (can_execute_code);

-- ----------------------------------------------------------------------------
-- agent_integrations  (depends on agents, integrations)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL,
    integration_id UUID NOT NULL,
    tools JSON NOT NULL DEFAULT '[]',
    config JSON,
    status integration_status NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX agent_integrations_agent_id_integration_id_unique ON agent_integrations (agent_id, integration_id);

-- ----------------------------------------------------------------------------
-- agent_sessions  (depends on tenants, users, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    title TEXT,
    directory TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    metadata JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    archived_at TIMESTAMP
);
CREATE INDEX agent_sessions_tenant_id_idx ON agent_sessions (tenant_id);
CREATE INDEX agent_sessions_user_id_idx ON agent_sessions (user_id);
CREATE INDEX agent_sessions_agent_id_idx ON agent_sessions (agent_id);
CREATE INDEX agent_sessions_is_active_idx ON agent_sessions (is_active);
CREATE INDEX agent_sessions_is_archived_idx ON agent_sessions (is_archived);
CREATE INDEX agent_sessions_created_at_idx ON agent_sessions (created_at);

-- ----------------------------------------------------------------------------
-- agent_templates  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    type TEXT NOT NULL,
    config JSON NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_public BOOLEAN NOT NULL DEFAULT false,
    is_official BOOLEAN NOT NULL DEFAULT false,
    metadata JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);
CREATE INDEX agent_templates_tenant_id_idx ON agent_templates (tenant_id);
CREATE INDEX agent_templates_slug_idx ON agent_templates (slug);
CREATE INDEX agent_templates_type_idx ON agent_templates (type);
CREATE INDEX agent_templates_is_public_idx ON agent_templates (is_public);
CREATE INDEX agent_templates_is_active_idx ON agent_templates (is_active);
CREATE INDEX agent_templates_tenant_slug_idx ON agent_templates (tenant_id, slug);

-- ----------------------------------------------------------------------------
-- user_tools  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE user_tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    code TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'javascript',
    parameters JSON NOT NULL DEFAULT '[]',
    permissions JSON NOT NULL DEFAULT '[]',
    config JSON NOT NULL DEFAULT '{"timeout":30000,"maxMemory":128,"allowConsole":true,"retryOnError":false,"maxRetries":3}',
    status TEXT NOT NULL DEFAULT 'draft',
    metadata JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP,
    is_active BOOLEAN NOT NULL DEFAULT true
);
CREATE INDEX user_tools_tenant_id_idx ON user_tools (tenant_id);
CREATE INDEX user_tools_slug_idx ON user_tools (slug);
CREATE INDEX user_tools_status_idx ON user_tools (status);
CREATE INDEX user_tools_tenant_slug_idx ON user_tools (tenant_id, slug);

-- ----------------------------------------------------------------------------
-- knowledge_entries  (depends on tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    type knowledge_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    source TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSON,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX knowledge_entries_tenant_id_idx ON knowledge_entries (tenant_id);
CREATE INDEX knowledge_entries_agent_id_idx ON knowledge_entries (agent_id);
CREATE INDEX knowledge_entries_type_idx ON knowledge_entries (type);

-- ----------------------------------------------------------------------------
-- knowledge_embeddings  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT NOT NULL,
    source TEXT NOT NULL,
    metadata JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX knowledge_embeddings_tenant_id_idx ON knowledge_embeddings (tenant_id);
CREATE INDEX knowledge_embeddings_tenant_id_source_idx ON knowledge_embeddings (tenant_id, source);

-- ----------------------------------------------------------------------------
-- scheduled_tasks  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    cron_expression TEXT NOT NULL,
    task_type TEXT NOT NULL,
    task_config JSON NOT NULL DEFAULT '{}',
    agent_id UUID,
    enabled BOOLEAN NOT NULL DEFAULT true,
    timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER NOT NULL DEFAULT 0,
    tool_id UUID,
    tool_type TEXT,
    tool_name TEXT,
    tool_params JSON NOT NULL DEFAULT '{}',
    notify_on_success BOOLEAN NOT NULL DEFAULT false,
    notify_on_failure BOOLEAN NOT NULL DEFAULT true,
    webhook_url TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX scheduled_tasks_tenant_id_idx ON scheduled_tasks (tenant_id);
CREATE INDEX scheduled_tasks_enabled_idx ON scheduled_tasks (enabled);
CREATE INDEX scheduled_tasks_tool_id_idx ON scheduled_tasks (tool_id);
CREATE INDEX scheduled_tasks_next_run_at_idx ON scheduled_tasks (next_run_at);

-- ----------------------------------------------------------------------------
-- simulation_sessions  (depends on tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE simulation_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    config JSON NOT NULL DEFAULT '{}',
    messages JSON NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'active',
    metrics JSON NOT NULL DEFAULT '{}',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP
);
CREATE INDEX simulation_sessions_tenant_id_idx ON simulation_sessions (tenant_id);
CREATE INDEX simulation_sessions_agent_id_idx ON simulation_sessions (agent_id);

-- ----------------------------------------------------------------------------
-- installed_skills  (depends on tenants, marketplace_skills)
-- ----------------------------------------------------------------------------
CREATE TABLE installed_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "marketplaceSkillId" UUID NOT NULL REFERENCES marketplace_skills(id) ON DELETE CASCADE,
    "localSkillId" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX installed_skills_tenantId_marketplaceSkillId_unique ON installed_skills ("tenantId", "marketplaceSkillId");
CREATE INDEX installed_skills_tenantId_idx ON installed_skills ("tenantId");

-- ----------------------------------------------------------------------------
-- usage_metrics  (depends on tenants, agent_sessions, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    metric_type TEXT NOT NULL,
    value INTEGER NOT NULL DEFAULT 0,
    model TEXT,
    session_id UUID,
    agent_id UUID,
    tool_name TEXT,
    metadata JSON NOT NULL DEFAULT '{}',
    period TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX usage_metrics_tenant_id_idx ON usage_metrics (tenant_id);
CREATE INDEX usage_metrics_metric_type_idx ON usage_metrics (metric_type);
CREATE INDEX usage_metrics_period_idx ON usage_metrics (period);
CREATE INDEX usage_metrics_tenant_period_metric_idx ON usage_metrics (tenant_id, period_start, metric_type);
CREATE INDEX usage_metrics_session_id_idx ON usage_metrics (session_id);
CREATE INDEX usage_metrics_agent_id_idx ON usage_metrics (agent_id);

-- ----------------------------------------------------------------------------
-- usage_events  (depends on tenants, agent_sessions, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    event_type TEXT NOT NULL,
    value INTEGER NOT NULL,
    model TEXT,
    session_id UUID,
    agent_id UUID,
    tool_name TEXT,
    metadata JSON NOT NULL DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX usage_events_tenant_id_idx ON usage_events (tenant_id);
CREATE INDEX usage_events_event_type_idx ON usage_events (event_type);
CREATE INDEX usage_events_session_id_idx ON usage_events (session_id);
CREATE INDEX usage_events_created_at_idx ON usage_events (created_at);

-- ----------------------------------------------------------------------------
-- usage_quotas  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE usage_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    quota_type TEXT NOT NULL,
    "limit" INTEGER NOT NULL,
    used INTEGER NOT NULL DEFAULT 0,
    reset_period TEXT NOT NULL,
    last_reset_at TIMESTAMP NOT NULL,
    next_reset_at TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX usage_quotas_tenant_id_idx ON usage_quotas (tenant_id);
CREATE INDEX usage_quotas_quota_type_idx ON usage_quotas (quota_type);

-- ----------------------------------------------------------------------------
-- audit_logs  (depends on tenants, users)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id TEXT,
    details JSON NOT NULL DEFAULT '{}',
    success TEXT NOT NULL DEFAULT 'yes',
    error_message TEXT,
    ip_address TEXT,
    user_agent TEXT,
    request_id TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX audit_logs_tenant_id_idx ON audit_logs (tenant_id);
CREATE INDEX audit_logs_user_id_idx ON audit_logs (user_id);
CREATE INDEX audit_logs_action_idx ON audit_logs (action);
CREATE INDEX audit_logs_resource_idx ON audit_logs (resource_type, resource_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs (created_at);
CREATE INDEX audit_logs_request_id_idx ON audit_logs (request_id);

-- ----------------------------------------------------------------------------
-- approval_requests  (depends on tenants, agent_sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE approval_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id UUID NOT NULL,
    tool_name TEXT NOT NULL,
    tool_params JSON,
    requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    notes TEXT,
    expires_at TIMESTAMP,
    execution_result JSON,
    execution_error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX approval_requests_tenant_id_idx ON approval_requests (tenant_id);
CREATE INDEX approval_requests_session_id_idx ON approval_requests (session_id);
CREATE INDEX approval_requests_status_idx ON approval_requests (status);
CREATE INDEX approval_requests_expires_at_idx ON approval_requests (expires_at);

-- ----------------------------------------------------------------------------
-- pending_responses  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE pending_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    agent_id UUID NOT NULL,
    proposed_response TEXT NOT NULL,
    reason TEXT,
    confidence DECIMAL(3,2),
    status TEXT NOT NULL DEFAULT 'PENDING',
    reviewed_by TEXT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX pending_responses_tenant_id_status_idx ON pending_responses (tenant_id, status);
CREATE INDEX pending_responses_status_idx ON pending_responses (status);

-- ----------------------------------------------------------------------------
-- approval_feedbacks  (depends on tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE approval_feedbacks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    response_id TEXT NOT NULL,
    conversation_id TEXT NOT NULL,
    proposed_response TEXT NOT NULL,
    rejection_reason TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX approval_feedbacks_tenant_id_idx ON approval_feedbacks (tenant_id);

-- ============================================================================
-- LAYER 4: Tables depending on Layer 3 (whatsapp_configs, agent_sessions, etc.)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- conversations  (depends on tenants, whatsapp_configs, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    config_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    phone_number TEXT NOT NULL,
    contact_name TEXT,
    contact_email TEXT,
    status conversation_status NOT NULL DEFAULT 'ACTIVE',
    last_message_at TIMESTAMP,
    message_count INTEGER NOT NULL DEFAULT 0,
    opencode_session_id TEXT,
    tags TEXT[] NOT NULL DEFAULT '{}',
    duration INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX conversations_tenant_id_phone_number_config_id_unique ON conversations (tenant_id, phone_number, config_id);
CREATE INDEX conversations_agent_id_idx ON conversations (agent_id);
CREATE INDEX conversations_status_idx ON conversations (status);
CREATE INDEX conversations_tenant_id_idx ON conversations (tenant_id);

-- ----------------------------------------------------------------------------
-- agent_messages  (depends on agent_sessions, tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_name TEXT,
    tool_call_id TEXT,
    tool_input JSON,
    tool_output JSON,
    parts JSON NOT NULL DEFAULT '[]',
    metadata JSON,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX agent_messages_session_id_idx ON agent_messages (session_id);
CREATE INDEX agent_messages_tenant_id_idx ON agent_messages (tenant_id);
CREATE INDEX agent_messages_role_idx ON agent_messages (role);
CREATE INDEX agent_messages_created_at_idx ON agent_messages (created_at);

-- ----------------------------------------------------------------------------
-- agent_template_installations  (depends on agent_templates, tenants, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_template_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    variables JSON NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active',
    installed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP
);
CREATE INDEX template_installations_template_id_idx ON agent_template_installations (template_id);
CREATE INDEX template_installations_tenant_id_idx ON agent_template_installations (tenant_id);
CREATE INDEX template_installations_agent_id_idx ON agent_template_installations (agent_id);

-- ----------------------------------------------------------------------------
-- user_tool_executions  (depends on user_tools, tenants)
-- ----------------------------------------------------------------------------
CREATE TABLE user_tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id UUID NOT NULL REFERENCES user_tools(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    input JSON NOT NULL DEFAULT '{}',
    output JSON,
    error TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    duration_ms INTEGER,
    memory_used INTEGER,
    logs JSON NOT NULL DEFAULT '[]',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    attempt INTEGER NOT NULL DEFAULT 1,
    max_attempts INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX user_tool_executions_tool_id_idx ON user_tool_executions (tool_id);
CREATE INDEX user_tool_executions_tenant_id_idx ON user_tool_executions (tenant_id);
CREATE INDEX user_tool_executions_status_idx ON user_tool_executions (status);
CREATE INDEX user_tool_executions_started_at_idx ON user_tool_executions (started_at);

-- ----------------------------------------------------------------------------
-- tool_executions  (depends on tenants, agent_sessions, approval_requests)
-- ----------------------------------------------------------------------------
CREATE TABLE tool_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    session_id UUID REFERENCES agent_sessions(id) ON DELETE SET NULL,
    tool_name TEXT NOT NULL,
    tool_params JSON,
    status TEXT NOT NULL DEFAULT 'running',
    result JSON,
    error TEXT,
    duration_ms INTEGER,
    approval_id UUID,
    requires_approval TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP
);
CREATE INDEX tool_executions_tenant_id_idx ON tool_executions (tenant_id);
CREATE INDEX tool_executions_session_id_idx ON tool_executions (session_id);
CREATE INDEX tool_executions_status_idx ON tool_executions (status);
CREATE INDEX tool_executions_tool_name_idx ON tool_executions (tool_name);
CREATE INDEX tool_executions_started_at_idx ON tool_executions (started_at);

-- ----------------------------------------------------------------------------
-- task_executions  (depends on scheduled_tasks)
-- ----------------------------------------------------------------------------
CREATE TABLE task_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP,
    result JSON,
    error TEXT
);
CREATE INDEX task_executions_task_id_idx ON task_executions (task_id);
CREATE INDEX task_executions_tenant_id_idx ON task_executions (tenant_id);
CREATE INDEX task_executions_status_idx ON task_executions (status);

-- ----------------------------------------------------------------------------
-- simulation_logs  (depends on simulation_sessions)
-- ----------------------------------------------------------------------------
CREATE TABLE simulation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES simulation_sessions(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    details JSON NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX simulation_logs_session_id_idx ON simulation_logs (session_id);

-- ----------------------------------------------------------------------------
-- memory_entries  (depends on conversation_contexts, agents)
-- ----------------------------------------------------------------------------
CREATE TABLE memory_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    context_id UUID NOT NULL REFERENCES conversation_contexts(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    key TEXT NOT NULL,
    value JSON NOT NULL,
    category TEXT,
    ttl TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX memory_entries_tenant_id_context_id_key_unique ON memory_entries (tenant_id, context_id, key);
CREATE INDEX memory_entries_tenant_id_idx ON memory_entries (tenant_id);
CREATE INDEX memory_entries_tenant_id_context_id_idx ON memory_entries (tenant_id, context_id);
CREATE INDEX memory_entries_tenant_id_agent_id_idx ON memory_entries (tenant_id, agent_id);
CREATE INDEX memory_entries_category_idx ON memory_entries (category);

-- ----------------------------------------------------------------------------
-- workspace_files  (depends on accomplish_tasks)
-- ----------------------------------------------------------------------------
CREATE TABLE workspace_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    task_id UUID REFERENCES accomplish_tasks(id) ON DELETE CASCADE,
    type file_type NOT NULL DEFAULT 'USER',
    path TEXT NOT NULL,
    name TEXT NOT NULL,
    size INTEGER NOT NULL,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX workspace_files_tenant_id_idx ON workspace_files (tenant_id);
CREATE INDEX workspace_files_task_id_idx ON workspace_files (task_id);
CREATE INDEX workspace_files_type_idx ON workspace_files (type);
CREATE INDEX workspace_files_expires_at_idx ON workspace_files (expires_at);

-- ============================================================================
-- LAYER 5: Tables depending on Layer 4 (conversations)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- messages  (depends on conversations)
-- ----------------------------------------------------------------------------
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id TEXT,
    in_reply_to TEXT,
    direction message_direction NOT NULL,
    type message_type NOT NULL DEFAULT 'TEXT',
    content TEXT,
    metadata JSON,
    status message_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX messages_conversation_id_idx ON messages (conversation_id);
CREATE INDEX messages_tenant_id_idx ON messages (tenant_id);
CREATE INDEX messages_direction_idx ON messages (direction);

-- ============================================================================
-- END OF SCRIPT
-- ============================================================================
-- Total tables: 47
--
-- Layer 0 (no FK deps):     users, plans, coupons, ai_global_config, ai_providers, marketplace_skills
-- Layer 1 (depends on L0):  tenants, ai_models, skill_reviews
-- Layer 2 (depends on L1):  tenant_users, ai_tenant_permissions, subscriptions, payments, invoices,
--                             dunning_attempts, agents, workspaces, tenant_usages, tenant_files,
--                             conversation_contexts, integrations, api_connectors, db_credentials,
--                             accomplish_tasks
-- Layer 3 (depends on L2):  whatsapp_configs, skills, tools, agent_integrations, agent_sessions,
--                             agent_templates, user_tools, knowledge_entries, knowledge_embeddings,
--                             scheduled_tasks, simulation_sessions, installed_skills, usage_metrics,
--                             usage_events, usage_quotas, audit_logs, approval_requests,
--                             pending_responses, approval_feedbacks
-- Layer 4 (depends on L3):  conversations, agent_messages, agent_template_installations,
--                             user_tool_executions, tool_executions, task_executions,
--                             simulation_logs, memory_entries, workspace_files
-- Layer 5 (depends on L4):  messages
-- ============================================================================
