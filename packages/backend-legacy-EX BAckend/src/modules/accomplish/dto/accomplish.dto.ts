/**
 * DTOs para el módulo Accomplish
 */

import { TaskStatus } from '@prisma/client';

// ============================================
// Create Task
// ============================================

export interface CreateTaskDto {
  prompt: string;
  sessionId?: string;
  userId?: string; // Usuario que crea la tarea (extraído del JWT)
}

// ============================================
// Task Response
// ============================================

export interface TaskDto {
  id: string;
  tenantId: string;
  userId?: string; // Usuario que creó la tarea
  prompt: string;
  status: TaskStatus;
  sessionId?: string;
  messages: TaskMessageDto[];
  result?: any;
  error?: string;
  workspacePath?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskMessageDto {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  metadata?: any;
}

// ============================================
// Follow-up
// ============================================

export interface FollowUpDto {
  message: string;
}

// ============================================
// Task Events (SSE)
// ============================================

export interface TaskEventDto {
  type: 'message' | 'tool' | 'permission' | 'progress' | 'complete' | 'error';
  data: any;
  timestamp: Date;
}

export interface TaskMessageEvent {
  type: 'message';
  data: {
    role: 'user' | 'assistant' | 'tool';
    content: string;
    messageId?: string;
  };
}

export interface TaskToolEvent {
  type: 'tool';
  data: {
    toolName: string;
    input: any;
    output?: any;
    status: 'started' | 'completed' | 'failed';
    duration?: number;
  };
}

export interface TaskPermissionEvent {
  type: 'permission';
  data: {
    requestId: string;
    toolName?: string;
    description: string;
    options?: string[];
    timeout: number;
  };
}

export interface TaskProgressEvent {
  type: 'progress';
  data: {
    step: string;
    progress: number; // 0-100
    details?: string;
  };
}

export interface TaskCompleteEvent {
  type: 'complete';
  data: {
    result: any;
    duration: number;
    workspacePath?: string;
  };
}

export interface TaskErrorEvent {
  type: 'error';
  data: {
    error: string;
    code?: string;
    details?: any;
  };
}

// ============================================
// Permission Request
// ============================================

export interface PermissionRequestDto {
  id: string;
  taskId: string;
  type: 'tool' | 'question' | 'custom';
  toolName?: string;
  description: string;
  options?: string[];
  timeout: number;
  createdAt: Date;
}

export interface PermissionResponseDto {
  decision: 'allow' | 'deny';
  options?: string[];
  customResponse?: string;
}

// ============================================
// Workspace
// ============================================

export interface WorkspaceUsageDto {
  tenantId: string;
  used: number;
  quota: number;
  percentUsed: number;
  userFiles: number;
  tasks: number;
  temp: number;
}

export interface WorkspaceFileDto {
  id: string;
  tenantId: string;
  taskId?: string;
  type: 'USER' | 'TASK' | 'TEMP';
  path: string;
  name: string;
  size: number;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateWorkspaceFileDto {
  taskId?: string;
  type: 'USER' | 'TASK' | 'TEMP';
  path: string;
  name: string;
  size: number;
}

// ============================================
// History
// ============================================

export interface TaskHistoryDto {
  tasks: TaskDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TaskHistoryQueryDto {
  page?: number;
  pageSize?: number;
  status?: TaskStatus;
  fromDate?: Date;
  toDate?: Date;
  userId?: string; // Filtrar por usuario específico
}

// ============================================
// Skills
// ============================================

export interface SkillDto {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  author: string;
  command?: string;
  tags: string[];
  isOfficial: boolean;
  isInstalled: boolean;
  installedVersion?: string;
  rating: number;
  ratingsCount: number;
}

export interface InstalledSkillDto {
  id: string;
  tenantId: string;
  marketplaceSkillId: string;
  localSkillId: string;
  installedVersion: string;
  skill: SkillDto;
  config?: Record<string, any>;
  enabledTools: string[];
}

export interface InstallSkillDto {
  marketplaceSkillId: string;
  config?: Record<string, any>;
}

export interface UpdateSkillConfigDto {
  config: Record<string, any>;
}

export interface ExecuteSkillDto {
  installationId: string;
  toolName: string;
  input: Record<string, any>;
}

export interface SkillExecutionResultDto {
  success: boolean;
  output?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface MarketplaceQueryDto {
  category?: string;
  search?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

export interface MarketplaceResponseDto {
  skills: SkillDto[];
  total: number;
  page: number;
  pageSize: number;
}
