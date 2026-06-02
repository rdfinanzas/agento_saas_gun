-- Migration: 20260311_add_agent_security_config
-- Agrega campos de configuración de seguridad y herramientas a WhatsAppConfig

-- Alter table whatsapp_configs
ALTER TABLE "whatsapp_configs"
ADD COLUMN "allowedTools" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "blockedTools" TEXT[] DEFAULT ARRAY['bash', 'write', 'edit', 'task']::TEXT[];
