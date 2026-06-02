-- CreateEnum
CREATE TYPE "ConnectionType" AS ENUM ('CLOUD_API', 'BAILEYS');

-- AlterTable
ALTER TABLE "whatsapp_configs" ADD COLUMN     "baileysSession" TEXT,
ADD COLUMN     "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
ADD COLUMN     "connectionType" "ConnectionType" NOT NULL DEFAULT 'CLOUD_API';
