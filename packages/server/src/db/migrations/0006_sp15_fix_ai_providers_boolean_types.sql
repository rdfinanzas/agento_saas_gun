-- Migration: SP-15 Fix AI Providers Boolean Types
-- Created: 2026-03-19
-- Description: Changes isActive and isDefault from text to boolean for ai_providers and ai_models tables

-- ============================================
-- Fix ai_providers table
-- ============================================
ALTER TABLE "ai_providers"
  ALTER COLUMN "isActive" TYPE boolean USING CASE
    WHEN "isActive" = 'true' THEN true
    ELSE false
  END,
  ALTER COLUMN "isDefault" TYPE boolean USING CASE
    WHEN "isDefault" = 'true' THEN true
    ELSE false
  END;

-- ============================================
-- Fix ai_models table
-- ============================================
ALTER TABLE "ai_models"
  ALTER COLUMN "isActive" TYPE boolean USING CASE
    WHEN "isActive" = 'true' THEN true
    ELSE false
  END,
  ALTER COLUMN "supportsVision" TYPE boolean USING CASE
    WHEN "supportsVision" = 'true' THEN true
    ELSE false
  END,
  ALTER COLUMN "supportsTools" TYPE boolean USING CASE
    WHEN "supportsTools" = 'true' THEN true
    ELSE false
  END,
  ALTER COLUMN "supportsStreaming" TYPE boolean USING CASE
    WHEN "supportsStreaming" = 'true' THEN true
    ELSE false
  END;

-- Update existing values to be true by default if they were 'true'
UPDATE "ai_providers" SET "isActive" = true WHERE "isActive" = false;
UPDATE "ai_models" SET "isActive" = true WHERE "isActive" = false;
