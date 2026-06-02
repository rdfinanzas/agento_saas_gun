-- Migration: SP-5 User Tools
-- Created: 2026-03-19
-- Description: Creates user_tools and user_tool_executions tables

-- ============================================
-- User Tools Table
-- ============================================
CREATE TABLE IF NOT EXISTS "user_tools" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "created_by" uuid,
    "name" text NOT NULL,
    "slug" text NOT NULL,
    "description" text,
    "code" text NOT NULL,
    "language" text DEFAULT 'javascript' NOT NULL,
    "parameters" jsonb DEFAULT '[]'::jsonb,
    "permissions" jsonb DEFAULT '[]'::jsonb,
    "config" jsonb DEFAULT '{"timeout": 30000, "maxMemory": 128, "allowConsole": true, "retryOnError": false, "maxRetries": 3}'::jsonb,
    "status" text DEFAULT 'draft' NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "deleted_at" timestamp,
    "is_active" boolean DEFAULT true NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_tools_tenant_id_idx" ON "user_tools" ("tenant_id");
CREATE INDEX IF NOT EXISTS "user_tools_slug_idx" ON "user_tools" ("slug");
CREATE INDEX IF NOT EXISTS "user_tools_status_idx" ON "user_tools" ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "user_tools_tenant_slug_idx" ON "user_tools" ("tenant_id", "slug") WHERE "is_active" = true AND "deleted_at" IS NULL;

-- ============================================
-- User Tool Executions Table
-- ============================================
CREATE TABLE IF NOT EXISTS "user_tool_executions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tool_id" uuid NOT NULL,
    "tenant_id" uuid NOT NULL,
    "executed_by" uuid,
    "session_id" uuid,
    "input" jsonb DEFAULT '{}'::jsonb,
    "output" jsonb,
    "error" text,
    "status" text DEFAULT 'pending' NOT NULL,
    "duration_ms" integer,
    "memory_used" integer,
    "logs" jsonb DEFAULT '[]'::jsonb,
    "started_at" timestamp DEFAULT now() NOT NULL,
    "completed_at" timestamp,
    "attempt" integer DEFAULT 1,
    "max_attempts" integer DEFAULT 1
);

CREATE INDEX IF NOT EXISTS "user_tool_executions_tool_id_idx" ON "user_tool_executions" ("tool_id");
CREATE INDEX IF NOT EXISTS "user_tool_executions_tenant_id_idx" ON "user_tool_executions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "user_tool_executions_status_idx" ON "user_tool_executions" ("status");
CREATE INDEX IF NOT EXISTS "user_tool_executions_started_at_idx" ON "user_tool_executions" ("started_at");

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE "user_tools" IS 'Herramientas creadas por los usuarios del sistema';
COMMENT ON TABLE "user_tool_executions" IS 'Historial de ejecuciones de herramientas de usuario';
