-- Migration: SP-14 Dashboard Extension
-- Created: 2026-03-19
-- Description: Dashboard API for agent coder metrics (no schema changes needed)

-- Nota: Esta migración no requiere cambios de schema
-- Los endpoints de dashboard usan las tablas existentes:
-- - agent_sessions
-- - agent_messages  
-- - user_tools
-- - user_tool_executions
-- - scheduled_tasks
-- - task_executions

-- Índices adicionales para mejor performance del dashboard
CREATE INDEX IF NOT EXISTS "agent_messages_tenant_created_idx" ON "agent_messages" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "user_tool_executions_tenant_started_idx" ON "user_tool_executions" ("tenant_id", "started_at");
