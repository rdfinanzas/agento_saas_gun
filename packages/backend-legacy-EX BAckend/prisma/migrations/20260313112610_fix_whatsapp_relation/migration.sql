/*
  Warnings:

  - Made the column `requireApproval` on table `whatsapp_configs` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "whatsapp_configs_tenantId_key";

-- AlterTable
ALTER TABLE "whatsapp_configs" ALTER COLUMN "allowedTools" DROP DEFAULT,
ALTER COLUMN "blockedTools" DROP DEFAULT,
ALTER COLUMN "requireApproval" SET NOT NULL,
ALTER COLUMN "approvalKeywords" DROP DEFAULT;
