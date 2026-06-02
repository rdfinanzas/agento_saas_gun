-- Migration: SP-11 Agent Templates
-- Created: 2026-03-19
-- Description: Creates agent_templates and agent_template_installations tables

-- ============================================
-- Agent Templates Table
-- ============================================
CREATE TABLE IF NOT EXISTS "agent_templates" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "description" text,
    "short_description" text,
    "type" text NOT NULL,
    "config" jsonb NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_public" boolean DEFAULT false NOT NULL,
    "is_official" boolean DEFAULT false NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "deleted_at" timestamp
);

CREATE INDEX IF NOT EXISTS "agent_templates_tenant_id_idx" ON "agent_templates" ("tenant_id");
CREATE INDEX IF NOT EXISTS "agent_templates_slug_idx" ON "agent_templates" ("slug");
CREATE INDEX IF NOT EXISTS "agent_templates_type_idx" ON "agent_templates" ("type");
CREATE INDEX IF NOT EXISTS "agent_templates_is_public_idx" ON "agent_templates" ("is_public");
CREATE INDEX IF NOT EXISTS "agent_templates_is_active_idx" ON "agent_templates" ("is_active");
CREATE UNIQUE INDEX IF NOT EXISTS "agent_templates_tenant_slug_idx" ON "agent_templates" ("tenant_id", "slug") WHERE "deleted_at" IS NULL;

-- ============================================
-- Agent Template Installations Table
-- ============================================
CREATE TABLE IF NOT EXISTS "agent_template_installations" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "template_id" uuid NOT NULL,
    "tenant_id" uuid NOT NULL,
    "agent_id" uuid,
    "variables" jsonb DEFAULT '{}'::jsonb,
    "status" text DEFAULT 'active' NOT NULL,
    "installed_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "last_used_at" timestamp
);

CREATE INDEX IF NOT EXISTS "template_installations_template_id_idx" ON "agent_template_installations" ("template_id");
CREATE INDEX IF NOT EXISTS "template_installations_tenant_id_idx" ON "agent_template_installations" ("tenant_id");
CREATE INDEX IF NOT EXISTS "template_installations_agent_id_idx" ON "agent_template_installations" ("agent_id");

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE "agent_templates" IS 'Templates pre-configurados para creación de agentes';
COMMENT ON TABLE "agent_template_installations" IS 'Registro de templates instalados por tenants';
