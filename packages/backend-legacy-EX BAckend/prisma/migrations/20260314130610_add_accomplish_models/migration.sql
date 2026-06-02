-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FileType" AS ENUM ('USER', 'TASK', 'TEMP');

-- CreateTable
CREATE TABLE "accomplish_tasks" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "sessionId" TEXT,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "result" JSONB,
    "error" TEXT,
    "workspacePath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "accomplish_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_files" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "FileType" NOT NULL DEFAULT 'USER',
    "path" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "accomplish_tasks_tenantId_idx" ON "accomplish_tasks"("tenantId");

-- CreateIndex
CREATE INDEX "accomplish_tasks_status_idx" ON "accomplish_tasks"("status");

-- CreateIndex
CREATE INDEX "accomplish_tasks_sessionId_idx" ON "accomplish_tasks"("sessionId");

-- CreateIndex
CREATE INDEX "accomplish_tasks_createdAt_idx" ON "accomplish_tasks"("createdAt");

-- CreateIndex
CREATE INDEX "workspace_files_tenantId_idx" ON "workspace_files"("tenantId");

-- CreateIndex
CREATE INDEX "workspace_files_taskId_idx" ON "workspace_files"("taskId");

-- CreateIndex
CREATE INDEX "workspace_files_type_idx" ON "workspace_files"("type");

-- CreateIndex
CREATE INDEX "workspace_files_expiresAt_idx" ON "workspace_files"("expiresAt");

-- AddForeignKey
ALTER TABLE "workspace_files" ADD CONSTRAINT "workspace_files_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "accomplish_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
