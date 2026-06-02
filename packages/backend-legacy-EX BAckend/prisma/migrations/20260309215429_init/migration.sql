/*
  Warnings:

  - Added the required column `updatedAt` to the `tenant_files` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'PAST_DUE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'AUTHORIZED', 'IN_PROCESS', 'REJECTED', 'CANCELLED', 'REFUNDED', 'CHARGED_BACK');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'OPEN', 'PAID', 'VOID', 'UNCOLLECTIBLE');

-- AlterEnum
ALTER TYPE "FileCategory" ADD VALUE 'GOOGLE_SHEET';

-- AlterTable
ALTER TABLE "tenant_files" ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "whatsapp_configs" ADD COLUMN     "agentLanguage" TEXT DEFAULT 'es',
ADD COLUMN     "agentName" TEXT,
ADD COLUMN     "agentRole" TEXT,
ADD COLUMN     "agentStyle" TEXT,
ADD COLUMN     "businessDescription" TEXT,
ADD COLUMN     "businessHours" JSONB,
ADD COLUMN     "businessName" TEXT,
ADD COLUMN     "businessPolicies" JSONB,
ADD COLUMN     "businessProcedures" JSONB,
ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "faq" JSONB,
ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "memory_entries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "contextId" TEXT NOT NULL,
    "agentId" TEXT,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT,
    "ttl" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_sessions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "messages" JSONB NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "simulation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "simulation_logs" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "simulation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheduled_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "taskConfig" JSONB NOT NULL DEFAULT '{}',
    "agentId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheduled_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_executions" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "result" JSONB,
    "error" TEXT,

    CONSTRAINT "task_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_connectors" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "baseUrl" TEXT NOT NULL,
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authConfig" JSONB DEFAULT '{}',
    "tools" JSONB NOT NULL DEFAULT '[]',
    "rawDocumentation" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_responses" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "proposedResponse" TEXT NOT NULL,
    "reason" TEXT,
    "confidence" DECIMAL(3,2),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_feedbacks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "proposedResponse" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketplace_skills" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0.0',
    "content" TEXT NOT NULL,
    "command" TEXT,
    "tags" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "downloads" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "ratingsCount" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "compatibility" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "marketplace_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_reviews" (
    "id" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installed_skills" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "marketplaceSkillId" TEXT NOT NULL,
    "localSkillId" TEXT NOT NULL,
    "installedVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installed_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_embeddings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "planName" TEXT NOT NULL,
    "tier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'PENDING',
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "gateway" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "gatewayCustomerId" TEXT,
    "gatewayPreapprovalId" TEXT,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "trialEnd" TIMESTAMP(3),
    "prorationCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'MERCADOPAGO',
    "gatewayPaymentId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "statusDetail" TEXT,
    "payerEmail" TEXT,
    "payerId" TEXT,
    "metadata" JSONB,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'MXN',
    "tax" DOUBLE PRECISION,
    "discount" DOUBLE PRECISION,
    "couponId" TEXT,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'OPEN',
    "paymentMethod" TEXT,
    "paymentReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discountType" TEXT NOT NULL,
    "discountValue" DOUBLE PRECISION NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "planIds" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dunning_attempts" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextRetryAt" TIMESTAMP(3),

    CONSTRAINT "dunning_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memory_entries_tenantId_idx" ON "memory_entries"("tenantId");

-- CreateIndex
CREATE INDEX "memory_entries_tenantId_contextId_idx" ON "memory_entries"("tenantId", "contextId");

-- CreateIndex
CREATE INDEX "memory_entries_tenantId_agentId_idx" ON "memory_entries"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "memory_entries_category_idx" ON "memory_entries"("category");

-- CreateIndex
CREATE UNIQUE INDEX "memory_entries_tenantId_contextId_key_key" ON "memory_entries"("tenantId", "contextId", "key");

-- CreateIndex
CREATE INDEX "simulation_sessions_tenantId_idx" ON "simulation_sessions"("tenantId");

-- CreateIndex
CREATE INDEX "simulation_sessions_agentId_idx" ON "simulation_sessions"("agentId");

-- CreateIndex
CREATE INDEX "simulation_logs_sessionId_idx" ON "simulation_logs"("sessionId");

-- CreateIndex
CREATE INDEX "scheduled_tasks_tenantId_idx" ON "scheduled_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "scheduled_tasks_enabled_idx" ON "scheduled_tasks"("enabled");

-- CreateIndex
CREATE INDEX "task_executions_taskId_idx" ON "task_executions"("taskId");

-- CreateIndex
CREATE INDEX "task_executions_tenantId_idx" ON "task_executions"("tenantId");

-- CreateIndex
CREATE INDEX "task_executions_status_idx" ON "task_executions"("status");

-- CreateIndex
CREATE INDEX "api_connectors_tenantId_idx" ON "api_connectors"("tenantId");

-- CreateIndex
CREATE INDEX "api_connectors_isActive_idx" ON "api_connectors"("isActive");

-- CreateIndex
CREATE INDEX "pending_responses_tenantId_status_idx" ON "pending_responses"("tenantId", "status");

-- CreateIndex
CREATE INDEX "pending_responses_status_idx" ON "pending_responses"("status");

-- CreateIndex
CREATE INDEX "approval_feedbacks_tenantId_idx" ON "approval_feedbacks"("tenantId");

-- CreateIndex
CREATE INDEX "marketplace_skills_category_idx" ON "marketplace_skills"("category");

-- CreateIndex
CREATE INDEX "marketplace_skills_authorId_idx" ON "marketplace_skills"("authorId");

-- CreateIndex
CREATE INDEX "marketplace_skills_status_idx" ON "marketplace_skills"("status");

-- CreateIndex
CREATE INDEX "skill_reviews_skillId_idx" ON "skill_reviews"("skillId");

-- CreateIndex
CREATE UNIQUE INDEX "skill_reviews_skillId_userId_key" ON "skill_reviews"("skillId", "userId");

-- CreateIndex
CREATE INDEX "installed_skills_tenantId_idx" ON "installed_skills"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "installed_skills_tenantId_marketplaceSkillId_key" ON "installed_skills"("tenantId", "marketplaceSkillId");

-- CreateIndex
CREATE INDEX "knowledge_embeddings_tenantId_idx" ON "knowledge_embeddings"("tenantId");

-- CreateIndex
CREATE INDEX "knowledge_embeddings_tenantId_source_idx" ON "knowledge_embeddings"("tenantId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_tenantId_key" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "subscriptions_tenantId_idx" ON "subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE INDEX "subscriptions_gatewayPreapprovalId_idx" ON "subscriptions"("gatewayPreapprovalId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_number_key" ON "invoices"("number");

-- CreateIndex
CREATE INDEX "invoices_tenantId_idx" ON "invoices"("tenantId");

-- CreateIndex
CREATE INDEX "invoices_status_idx" ON "invoices"("status");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupons_active_idx" ON "coupons"("active");

-- CreateIndex
CREATE INDEX "dunning_attempts_subscriptionId_idx" ON "dunning_attempts"("subscriptionId");

-- CreateIndex
CREATE INDEX "dunning_attempts_status_idx" ON "dunning_attempts"("status");

-- AddForeignKey
ALTER TABLE "memory_entries" ADD CONSTRAINT "memory_entries_contextId_fkey" FOREIGN KEY ("contextId") REFERENCES "conversation_contexts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "simulation_logs" ADD CONSTRAINT "simulation_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "simulation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_executions" ADD CONSTRAINT "task_executions_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_reviews" ADD CONSTRAINT "skill_reviews_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "marketplace_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installed_skills" ADD CONSTRAINT "installed_skills_marketplaceSkillId_fkey" FOREIGN KEY ("marketplaceSkillId") REFERENCES "marketplace_skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dunning_attempts" ADD CONSTRAINT "dunning_attempts_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
