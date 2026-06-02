/**
 * OpenCodeChatService - Chat que usa OpenCode CLI real
 * Este servicio integra el TaskManager que usa node-pty para ejecutar OpenCode
 */

import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as os from 'os';
import { getOpenCodeTaskManager, type TaskCallbacks } from '../../opencode/internal/classes/OpenCodeTaskManager';
import type { TaskConfig, TaskResult } from '../../opencode/internal/classes/types/opencode';
import type { ProviderType } from '../../opencode/common/types/provider';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    tokens?: number;
    model?: string;
    provider?: string;
    toolCalls?: ToolCallInfo[];
  };
}

export interface ToolCallInfo {
  name: string;
  arguments: any;
  result?: string;
}

export interface ChatSession {
  id: string;
  tenantId: string;
  userId: string;
  messages: ChatMessage[];
  config: ChatConfig;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatConfig {
  provider: ProviderType;
  model: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  enableTools?: boolean;
}

export interface SendMessageOptions {
  sessionId?: string;
  mode?: 'FULL' | 'LIMITED';
  attachments?: Array<{
    type: 'image' | 'file';
    mimeType: string;
    data: string;
    name?: string;
  }>;
  stream?: boolean;
  onProgress?: (event: ChatProgressEvent) => void;
}

export interface ChatProgressEvent {
  type: 'thought' | 'action' | 'text' | 'tool_use' | 'tool_result' | 'complete' | 'error';
  content: string;
  metadata?: any;
}

export interface SendMessageResult {
  response: string;
  sessionId: string;
  messageId: string;
  mode: 'FULL' | 'LIMITED';
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  toolCalls?: ToolCallInfo[];
}

export class OpenCodeChatService {
  private taskManager = getOpenCodeTaskManager({
    maxConcurrentTasks: 10,
    workspacePath: path.join(os.homedir(), '.agento', 'workspaces'),
  });
  private sessions: Map<string, ChatSession> = new Map();
  private initialized: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      await this.taskManager.initialize();
      this.initialized = true;
      console.log('[OpenCodeChatService] Initialized with OpenCode CLI');
    } catch (error) {
      console.error('[OpenCodeChatService] Failed to initialize:', error);
    }
  }

  async sendMessage(
    tenantId: string,
    message: string,
    mode: 'FULL' | 'LIMITED' = 'FULL',
    options: SendMessageOptions = {},
  ): Promise<SendMessageResult> {
    await this.initialize();

    const sessionId = options.sessionId || uuidv4();
    const messageId = uuidv4();

    let session = this.sessions.get(sessionId);
    if (!session) {
      session = await this.createSession(tenantId, sessionId);
    }

    const userMessage: ChatMessage = {
      id: messageId,
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    session.messages.push(userMessage);

    const config = session.config;

    let responseText = '';
    const toolCalls: ToolCallInfo[] = [];

    return new Promise((resolve, reject) => {
      const taskId = uuidv4();

      const taskConfig: TaskConfig = {
        taskId,
        tenantId,
        provider: config.provider,
        model: config.model,
        prompt: message,
        systemPrompt: config.systemPrompt,
        workingDirectory: path.join(os.homedir(), '.agento', 'workspaces', tenantId),
        maxTokens: config.maxTokens,
        temperature: config.temperature,
      };

      const callbacks: TaskCallbacks = {
        onProgress: (progress) => {
          options.onProgress?.({
            type: progress.stage === 'starting' ? 'thought' : 'action',
            content: progress.message || progress.stage,
          });
        },
        onReasoning: (text) => {
          options.onProgress?.({
            type: 'thought',
            content: text,
          });
        },
        onToolUse: (toolName, toolInput) => {
          toolCalls.push({
            name: toolName,
            arguments: toolInput,
          });
          options.onProgress?.({
            type: 'tool_use',
            content: `Ejecutando: ${toolName}`,
            metadata: { toolName, args: toolInput },
          });
        },
        onToolCallComplete: (data) => {
          const idx = toolCalls.findIndex(t => t.name === data.toolName);
          if (idx >= 0) {
            toolCalls[idx].result = data.toolOutput;
          }
          options.onProgress?.({
            type: 'tool_result',
            content: data.toolOutput,
            metadata: { toolName: data.toolName },
          });
        },
        onComplete: (result) => {
          if (result.status === 'success') {
            options.onProgress?.({
              type: 'complete',
              content: responseText,
            });
          }

          const assistantMessage: ChatMessage = {
            id: uuidv4(),
            role: 'assistant',
            content: responseText,
            timestamp: new Date(),
            metadata: {
              tokens: (result.usage?.inputTokens || 0) + (result.usage?.outputTokens || 0),
              model: config.model,
              provider: config.provider,
              toolCalls,
            },
          };
          session!.messages.push(assistantMessage);
          session!.updatedAt = new Date();

          resolve({
            response: responseText,
            sessionId,
            messageId: assistantMessage.id,
            mode,
            tokens: result.usage ? {
              input: result.usage.inputTokens,
              output: result.usage.outputTokens,
              total: result.usage.totalTokens,
            } : undefined,
            toolCalls,
          });
        },
        onError: (error) => {
          options.onProgress?.({
            type: 'error',
            content: error.message,
          });
          reject(new Error(`Error en tarea: ${error.message}`));
        },
      };

      this.taskManager.startTask(taskId, taskConfig, callbacks).catch(reject);
    });
  }

  private async createSession(tenantId: string, sessionId: string): Promise<ChatSession> {
    const config: ChatConfig = {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      systemPrompt: 'Eres un asistente útil y amigable que puede ejecutar código, leer archivos, y ayudarte con tareas de programación.',
      maxTokens: 4096,
      temperature: 0.7,
      enableTools: true,
    };

    const session: ChatSession = {
      id: sessionId,
      tenantId,
      userId: 'default',
      messages: [],
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  async getHistory(tenantId: string, sessionId?: string): Promise<{
    tenantId: string;
    sessionId?: string;
    messages: ChatMessage[];
  }> {
    if (sessionId) {
      const session = this.sessions.get(sessionId);
      if (session && session.tenantId === tenantId) {
        return {
          tenantId,
          sessionId,
          messages: session.messages,
        };
      }
    }

    return {
      tenantId,
      sessionId,
      messages: [],
    };
  }

  async clearHistory(tenantId: string, sessionId: string): Promise<{ success: boolean }> {
    const session = this.sessions.get(sessionId);
    if (session && session.tenantId === tenantId) {
      session.messages = [];
      session.updatedAt = new Date();
      return { success: true };
    }
    return { success: false };
  }

  async cancelTask(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      const activeTasks = this.taskManager.getActiveTaskIds();
      if (activeTasks.length > 0) {
        await this.taskManager.cancelTask(activeTasks[0]);
      }
    }
  }

  getActiveSessions(tenantId: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.tenantId === tenantId);
  }

  dispose(): void {
    this.taskManager.dispose();
  }
}

export const openCodeChatService = new OpenCodeChatService();
