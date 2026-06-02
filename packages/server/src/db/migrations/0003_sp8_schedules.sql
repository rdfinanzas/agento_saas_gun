-- Migration: SP-8 Schedules Extension
-- Created: 2026-03-19
-- Description: Extends scheduled_tasks table for tool execution

-- Agregar nuevas columnas a scheduled_tasks
ALTER TABLE "scheduled_tasks" 
  ADD COLUMN IF NOT EXISTS "description" text,
  ADD COLUMN IF NOT EXISTS "tool_id" uuid,
  ADD COLUMN IF NOT EXISTS "tool_type" text,
  ADD COLUMN IF NOT EXISTS "tool_name" text,
  ADD COLUMN IF NOT EXISTS "tool_params" jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "notify_on_success" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "notify_on_failure" boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS "webhook_url" text;

-- Crear índices adicionales
CREATE INDEX IF NOT EXISTS "scheduled_tasks_tool_id_idx" ON "scheduled_tasks" ("tool_id");
CREATE INDEX IF NOT EXISTS "scheduled_tasks_next_run_at_idx" ON "scheduled_tasks" ("next_run_at");

-- Comentarios
COMMENT ON COLUMN "scheduled_tasks"."tool_id" IS 'ID de la tool (system o user) a ejecutar';
COMMENT ON COLUMN "scheduled_tasks"."tool_type" IS 'Tipo: system | user';
COMMENT ON COLUMN "scheduled_tasks"."tool_name" IS 'Nombre de la tool para system tools';
COMMENT ON COLUMN "scheduled_tasks"."tool_params" IS 'Parámetros para la tool';
