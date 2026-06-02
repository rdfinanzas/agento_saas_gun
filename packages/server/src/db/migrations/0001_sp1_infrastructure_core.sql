-- Migration: SP-1 Infrastructure Core
-- Created: 2026-03-19
-- Description: Creates workspaces, db_credentials, agent_sessions, and agent_messages tables

-- ============================================
-- Workspaces Table
-- ============================================
CREATE TABLE IF NOT EXISTS "workspaces" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL UNIQUE,
    "path" text NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workspaces_tenant_id_idx" ON "workspaces" ("tenant_id");
CREATE INDEX IF NOT EXISTS "workspaces_is_active_idx" ON "workspaces" ("is_active");

-- ============================================
-- Accomplish Tasks Table (Agent Coder Tasks)
-- ============================================
CREATE TABLE IF NOT EXISTS "accomplish_tasks" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "user_id" uuid,
    "prompt" text NOT NULL,
    "status" text DEFAULT 'QUEUED' NOT NULL,
    "session_id" text,
    "messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
    "result" jsonb,
    "error" text,
    "workspace_path" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "started_at" timestamp,
    "completed_at" timestamp
);

CREATE INDEX IF NOT EXISTS "accomplish_tasks_tenant_id_idx" ON "accomplish_tasks" ("tenant_id");
CREATE INDEX IF NOT EXISTS "accomplish_tasks_user_id_idx" ON "accomplish_tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "accomplish_tasks_status_idx" ON "accomplish_tasks" ("status");
CREATE INDEX IF NOT EXISTS "accomplish_tasks_session_id_idx" ON "accomplish_tasks" ("session_id");
CREATE INDEX IF NOT EXISTS "accomplish_tasks_created_at_idx" ON "accomplish_tasks" ("created_at");

-- ============================================
-- Workspace Files Table
-- ============================================
CREATE TABLE IF NOT EXISTS "workspace_files" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "task_id" uuid REFERENCES "accomplish_tasks"("id") ON DELETE CASCADE,
    "type" text DEFAULT 'USER' NOT NULL,
    "path" text NOT NULL,
    "name" text NOT NULL,
    "size" integer NOT NULL,
    "expires_at" timestamp,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "workspace_files_tenant_id_idx" ON "workspace_files" ("tenant_id");
CREATE INDEX IF NOT EXISTS "workspace_files_task_id_idx" ON "workspace_files" ("task_id");
CREATE INDEX IF NOT EXISTS "workspace_files_type_idx" ON "workspace_files" ("type");
CREATE INDEX IF NOT EXISTS "workspace_files_expires_at_idx" ON "workspace_files" ("expires_at");

-- ============================================
-- DB Credentials Table
-- ============================================
CREATE TABLE IF NOT EXISTS "db_credentials" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "name" text NOT NULL,
    "description" text,
    "type" text NOT NULL,
    "host" text NOT NULL,
    "port" text NOT NULL,
    "database" text NOT NULL,
    "username" text NOT NULL,
    "password" text NOT NULL, -- ENCRYPTED with AES-256-GCM
    "connection_string" text, -- ENCRYPTED
    "config" jsonb,
    "is_active" boolean DEFAULT true NOT NULL,
    "last_test_at" timestamp,
    "last_test_status" text,
    "last_test_error" text,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "db_credentials_tenant_id_idx" ON "db_credentials" ("tenant_id");
CREATE INDEX IF NOT EXISTS "db_credentials_type_idx" ON "db_credentials" ("type");
CREATE INDEX IF NOT EXISTS "db_credentials_is_active_idx" ON "db_credentials" ("is_active");
CREATE INDEX IF NOT EXISTS "db_credentials_name_idx" ON "db_credentials" ("name");

-- ============================================
-- Agent Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS "agent_sessions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id" uuid NOT NULL,
    "user_id" uuid,
    "agent_id" uuid,
    "title" text,
    "directory" text,
    "is_active" boolean DEFAULT true NOT NULL,
    "is_archived" boolean DEFAULT false NOT NULL,
    "metadata" jsonb DEFAULT '{}'::jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp DEFAULT now() NOT NULL,
    "archived_at" timestamp
);

CREATE INDEX IF NOT EXISTS "agent_sessions_tenant_id_idx" ON "agent_sessions" ("tenant_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_user_id_idx" ON "agent_sessions" ("user_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_agent_id_idx" ON "agent_sessions" ("agent_id");
CREATE INDEX IF NOT EXISTS "agent_sessions_is_active_idx" ON "agent_sessions" ("is_active");
CREATE INDEX IF NOT EXISTS "agent_sessions_is_archived_idx" ON "agent_sessions" ("is_archived");
CREATE INDEX IF NOT EXISTS "agent_sessions_created_at_idx" ON "agent_sessions" ("created_at");

-- ============================================
-- Agent Messages Table
-- ============================================
CREATE TABLE IF NOT EXISTS "agent_messages" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "session_id" uuid NOT NULL,
    "tenant_id" uuid NOT NULL,
    "role" text NOT NULL,
    "content" text,
    "tool_name" text,
    "tool_call_id" text,
    "tool_input" jsonb,
    "tool_output" jsonb,
    "parts" jsonb DEFAULT '[]'::jsonb,
    "metadata" jsonb,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_messages_session_id_idx" ON "agent_messages" ("session_id");
CREATE INDEX IF NOT EXISTS "agent_messages_tenant_id_idx" ON "agent_messages" ("tenant_id");
CREATE INDEX IF NOT EXISTS "agent_messages_role_idx" ON "agent_messages" ("role");
CREATE INDEX IF NOT EXISTS "agent_messages_created_at_idx" ON "agent_messages" ("created_at");

-- ============================================
-- Foreign Key Constraints (Optional - add if needed)
-- ============================================
-- Note: tenant_id references are intentionally not enforced as foreign keys
-- to avoid tight coupling. Application layer ensures data integrity.
