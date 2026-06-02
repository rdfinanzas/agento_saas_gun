-- AlterTable
ALTER TABLE "accomplish_tasks" ADD COLUMN "userId" TEXT;

-- CreateIndex
CREATE INDEX "accomplish_tasks_userId_idx" ON "accomplish_tasks"("userId");
