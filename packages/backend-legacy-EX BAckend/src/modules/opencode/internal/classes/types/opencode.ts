/**
 * Tipos de OpenCode para el agente
 * Portado desde Accomplish agent-core
 */

export interface OpenCodeMessage {
  type: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
  content?: string;
  tool_use_id?: string;
  is_error?: boolean;
  delta?: {
    type?: string;
    text?: string;
    thinking?: string;
    content?: Array<{
      type: string;
      text?: string;
    }>;
  };
  error?: string;
  [key: string]: any;
}

export interface ToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, any>;
}

export interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface ThoughtContent {
  type: 'thinking';
  thinking: string;
}

export interface ContentBlock {
  type: 'text' | 'tool_use' | 'thinking';
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, any>;
}

export interface TaskConfig {
  taskId: string;
  tenantId?: string;
  provider: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  workingDirectory?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TaskResult {
  status: 'success' | 'error' | 'cancelled';
  sessionId?: string;
  output?: string;
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  duration?: number;
}

export interface TaskStatus {
  id: string;
  status: 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
}

export interface Task {
  id: string;
  prompt: string;
  status: TaskStatus['status'];
  messages: any[];
  createdAt: string;
}

export interface TaskMessage {
  id: string;
  type: string;
  content?: string;
  [key: string]: any;
}

export interface PermissionRequest {
  id: string;
  type: string;
  operation: string;
  resource: string;
  details?: string;
}

export interface TodoItem {
  id: string;
  content: string;
  completed: boolean;
}
