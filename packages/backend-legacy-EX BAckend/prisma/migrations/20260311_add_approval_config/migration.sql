-- Migration: 20260311_add_approval_config
-- Agrega campos de configuración de aprobaciones a WhatsAppConfig (PLAN #7)

-- Alter table whatsapp_configs
ALTER TABLE "whatsapp_configs"
ADD COLUMN "requireApproval" BOOLEAN DEFAULT FALSE,
ADD COLUMN "approvalThreshold" DOUBLE PRECISION,
ADD COLUMN "approvalKeywords" TEXT[] DEFAULT ARRAY[]::TEXT[];
