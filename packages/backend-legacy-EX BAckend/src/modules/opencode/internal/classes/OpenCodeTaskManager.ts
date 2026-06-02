/**
 * OpenCodeTaskManager - Gestor de tareas usando OpenCode CLI real
 * Integra con node-pty para ejecutar el CLI de OpenCode
 */

import * as crypto from 'crypto';
import * as path from 'path';
import * as os from 'os';
import { OpenCodeAdapter, createOpenCodeAdapter, type AdapterOptions } from './OpenCodeAdapter';
import { getCliResolver, type CliResolution } from '../../services/cli-resolver.service';
import type { TaskConfig, TaskResult, TaskStatus, PermissionRequest, TodoItem } from './types/opencode';

export interface TaskProgressEvent {
  stage: string;
  message?: string;
  isFirstTask?: boolean;
  modelName?: string;
}

export interface TaskCallbacks {
  onMessage?: (message: any) => void;
  onProgress: (progress: TaskProgressEvent) => void;
  onPermissionRequest?: (request: PermissionRequest) => void;
  onComplete: (result: TaskResult) => void;
  onError: (error: Error) => void;
  onDebug?: (log: { type: string; message: string; data?: unknown }) => void;
  onTodoUpdate?: (todos: TodoItem[]) => void;
  onAuthError?: (error: { providerId: string; message: string }) => void;
  onReasoning?: (text: string) => void;
  onToolUse?: (toolName: string, toolInput: unknown) => void;
  onToolCallComplete?: (data: {
    toolName: string;
    toolInput: unknown;
    toolOutput: string;
    sessionId?: string;
  }) => void;
  onStepFinish?: (data: {
    reason: string;
    model?: string;
    tokens?: {
      input: number;
      output: number;
      reasoning: number;
    };
    cost?: number;
  }) => void;
}

export interface TaskManagerOptions {
  maxConcurrentTasks?: number;
  defaultTimeout?: number;
  workingDirectory?: string;
  workspacePath?: string;
}

interface ManagedTask {
  taskId: string;
  adapter: OpenCodeAdapter;
  callbacks: TaskCallbacks;
  cleanup: () => void;
  createdAt: Date;
}

interface QueuedTask {
  taskId: string;
  config: TaskConfig;
  callbacks: TaskCallbacks;
  createdAt: Date;
}

export class OpenCodeTaskManager {
  private activeTasks: Map<string, ManagedTask> = new Map();
  private taskQueue: QueuedTask[] = [];
  private maxConcurrentTasks: number;
  private defaultTimeout: number;
  private workspacePath: string;
  private cliResolution: CliResolution | null = null;
  private isFirstTask: boolean = true;

  constructor(options: TaskManagerOptions = {}) {
    this.maxConcurrentTasks = options.maxConcurrentTasks ?? 10;
    this.defaultTimeout = options.defaultTimeout ?? 600000;
    this.workspacePath = options.workspacePath || path.join(os.homedir(), '.agento', 'workspaces');
  }

  async initialize(): Promise<void> {
    const resolver = getCliResolver();
    this.cliResolution = await resolver.resolveForOpenCode();
    console.log('[OpenCodeTaskManager] Initialized with CLI:', this.cliResolution.source);
  }

  async startTask(taskId: string, config: TaskConfig, callbacks: TaskCallbacks): Promise<string> {
    if (!this.cliResolution) {
      await this.initialize();
    }

    if (this.activeTasks.has(taskId) || this.taskQueue.some(q => q.taskId === taskId)) {
      throw new Error(`Task ${taskId} is already running or queued`);
    }

    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      console.log(`[OpenCodeTaskManager] At max concurrent tasks. Queueing task ${taskId}`);
      return this.queueTask(taskId, config, callbacks);
    }

    return this.executeTask(taskId, config, callbacks);
  }

  private queueTask(taskId: string, config: TaskConfig, callbacks: TaskCallbacks): string {
    if (this.taskQueue.length >= this.maxConcurrentTasks) {
      throw new Error('Maximum queued tasks reached. Please wait.');
    }

    const queuedTask: QueuedTask = {
      taskId,
      config,
      callbacks,
      createdAt: new Date(),
    };

    this.taskQueue.push(queuedTask);
    console.log(`[OpenCodeTaskManager] Task ${taskId} queued. Queue: ${this.taskQueue.length}`);

    return taskId;
  }

  private async executeTask(taskId: string, config: TaskConfig, callbacks: TaskCallbacks): Promise<string> {
    const adapterOptions: AdapterOptions = {
      platform: process.platform,
      isPackaged: false,
      tempPath: path.join(os.tmpdir(), 'agento'),
      getCliCommand: () => ({
        command: this.cliResolution?.command || 'opencode',
        args: this.cliResolution?.args || [],
      }),
      buildEnvironment: async () => ({
        ...process.env,
        OPENCODE_WORKSPACE: path.join(this.workspacePath, config.tenantId || 'default'),
      }),
      buildCliArgs: async (taskConfig) => {
        const args = [
          '--prompt', taskConfig.prompt,
          '--provider', taskConfig.provider,
          '--model', taskConfig.model,
          '--no-interactive',
        ];

        if (taskConfig.systemPrompt) {
          args.push('--system', taskConfig.systemPrompt);
        }

        if (taskConfig.workingDirectory) {
          args.push('--working-dir', taskConfig.workingDirectory);
        }

        return args;
      },
    };

    const adapter = createOpenCodeAdapter(adapterOptions, taskId);

    adapter.on('message', (message) => {
      callbacks.onMessage?.(message);
    });

    adapter.on('progress', (progress) => {
      callbacks.onProgress(progress);
    });

    adapter.on('permission-request', (request) => {
      callbacks.onPermissionRequest?.(request);
    });

    adapter.on('complete', (result) => {
      callbacks.onComplete(result);
      this.cleanupTask(taskId);
      this.processQueue();
    });

    adapter.on('error', (error) => {
      callbacks.onError(error);
      this.cleanupTask(taskId);
      this.processQueue();
    });

    adapter.on('debug', (log) => {
      callbacks.onDebug?.(log);
    });

    adapter.on('reasoning', (text) => {
      callbacks.onReasoning?.(text);
    });

    adapter.on('tool-use', (toolName, toolInput) => {
      callbacks.onToolUse?.(toolName, toolInput);
    });

    adapter.on('tool-call-complete', (data) => {
      callbacks.onToolCallComplete?.(data);
    });

    const cleanup = () => {
      adapter.dispose();
    };

    const managedTask: ManagedTask = {
      taskId,
      adapter,
      callbacks,
      cleanup,
      createdAt: new Date(),
    };

    this.activeTasks.set(taskId, managedTask);
    console.log(`[OpenCodeTaskManager] Executing task ${taskId}. Active: ${this.activeTasks.size}`);

    try {
      callbacks.onProgress({ stage: 'starting', message: 'Starting task...', isFirstTask: this.isFirstTask });
      
      if (this.isFirstTask) {
        this.isFirstTask = false;
      }

      await adapter.startTask({
        ...config,
        taskId,
        workingDirectory: config.workingDirectory || this.workspacePath,
      });
    } catch (error) {
      console.error(`[OpenCodeTaskManager] Task startup failed for ${taskId}:`, error);
      callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      this.cleanupTask(taskId);
      this.processQueue();
    }

    return taskId;
  }

  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0 && this.activeTasks.size < this.maxConcurrentTasks) {
      const nextTask = this.taskQueue.shift()!;
      console.log(`[OpenCodeTaskManager] Processing queue. Starting ${nextTask.taskId}`);

      try {
        await this.executeTask(nextTask.taskId, nextTask.config, nextTask.callbacks);
      } catch (error) {
        console.error(`[OpenCodeTaskManager] Error starting queued task:`, error);
        nextTask.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  async cancelTask(taskId: string): Promise<void> {
    const queueIndex = this.taskQueue.findIndex(q => q.taskId === taskId);
    if (queueIndex !== -1) {
      this.taskQueue.splice(queueIndex, 1);
      console.log(`[OpenCodeTaskManager] Cancelled queued task ${taskId}`);
      return;
    }

    const managedTask = this.activeTasks.get(taskId);
    if (!managedTask) {
      console.warn(`[OpenCodeTaskManager] Task ${taskId} not found`);
      return;
    }

    console.log(`[OpenCodeTaskManager] Cancelling running task ${taskId}`);
    await managedTask.adapter.cancelTask();
    this.cleanupTask(taskId);
    this.processQueue();
  }

  async interruptTask(taskId: string): Promise<void> {
    const managedTask = this.activeTasks.get(taskId);
    if (!managedTask) {
      console.warn(`[OpenCodeTaskManager] Task ${taskId} not found for interruption`);
      return;
    }

    console.log(`[OpenCodeTaskManager] Interrupting task ${taskId}`);
    await managedTask.adapter.interruptTask();
  }

  async sendResponse(taskId: string, response: string): Promise<void> {
    const managedTask = this.activeTasks.get(taskId);
    if (!managedTask) {
      throw new Error(`Task ${taskId} not found or not active`);
    }

    await managedTask.adapter.sendResponse(response);
  }

  isTaskRunning(taskId: string): boolean {
    const managedTask = this.activeTasks.get(taskId);
    return managedTask?.adapter.running ?? false;
  }

  hasActiveTask(taskId: string): boolean {
    return this.activeTasks.has(taskId);
  }

  hasRunningTask(): boolean {
    return this.activeTasks.size > 0;
  }

  getQueueLength(): number {
    return this.taskQueue.length;
  }

  getActiveTaskCount(): number {
    return this.activeTasks.size;
  }

  getActiveTaskIds(): string[] {
    return Array.from(this.activeTasks.keys());
  }

  cancelAllTasks(): void {
    console.log(`[OpenCodeTaskManager] Cancelling all ${this.activeTasks.size} active tasks`);
    this.taskQueue = [];

    for (const [taskId] of this.activeTasks) {
      this.cancelTask(taskId).catch(console.error);
    }
  }

  private cleanupTask(taskId: string): void {
    const managedTask = this.activeTasks.get(taskId);
    if (managedTask) {
      console.log(`[OpenCodeTaskManager] Cleaning up task ${taskId}`);
      managedTask.cleanup();
      this.activeTasks.delete(taskId);
    }
  }

  dispose(): void {
    console.log(`[OpenCodeTaskManager] Disposing (${this.activeTasks.size} active, ${this.taskQueue.length} queued)`);
    this.taskQueue = [];

    for (const [taskId, managedTask] of this.activeTasks) {
      try {
        managedTask.cleanup();
      } catch (error) {
        console.error(`[OpenCodeTaskManager] Error cleaning up task ${taskId}:`, error);
      }
    }

    this.activeTasks.clear();
  }
}

let taskManagerInstance: OpenCodeTaskManager | null = null;

export function getOpenCodeTaskManager(options?: TaskManagerOptions): OpenCodeTaskManager {
  if (!taskManagerInstance) {
    taskManagerInstance = new OpenCodeTaskManager(options);
  }
  return taskManagerInstance;
}

export function createOpenCodeTaskManager(options?: TaskManagerOptions): OpenCodeTaskManager {
  return new OpenCodeTaskManager(options);
}

export { OpenCodeAdapter };
