/**
 * OpenCodeAdapter - Ejecuta tareas usando OpenCode CLI real via node-pty
 * Portado desde Accomplish agent-core
 */

import * as crypto from 'crypto';
import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { StreamParser } from './StreamParser';
import type { 
  OpenCodeMessage, 
  TaskConfig, 
  Task, 
  TaskResult,
  PermissionRequest,
  TodoItem
} from './types/opencode.js';

export interface AdapterOptions {
  platform: NodeJS.Platform;
  isPackaged: boolean;
  tempPath: string;
  getCliCommand: () => { command: string; args: string[] };
  buildEnvironment: (taskId: string) => Promise<NodeJS.ProcessEnv>;
  buildCliArgs: (config: TaskConfig) => Promise<string[]>;
  onBeforeStart?: () => Promise<void>;
}

export interface OpenCodeAdapterEvents {
  message: [OpenCodeMessage];
  'tool-use': [string, unknown];
  'tool-result': [string];
  'permission-request': [PermissionRequest];
  progress: [{ stage: string; message?: string; modelName?: string }];
  complete: [TaskResult];
  error: [Error];
  debug: [{ type: string; message: string; data?: unknown }];
  'todo:update': [TodoItem[]];
  'auth-error': [{ providerId: string; message: string }];
  reasoning: [string];
  'tool-call-complete': [{
    toolName: string;
    toolInput: unknown;
    toolOutput: string;
    sessionId?: string;
  }];
  'step-finish': [{
    reason: string;
    model?: string;
    tokens?: {
      input: number;
      output: number;
      reasoning: number;
    };
    cost?: number;
  }];
}

export class OpenCodeAdapter extends EventEmitter<OpenCodeAdapterEvents> {
  private ptyProcess: pty.IPty | null = null;
  private streamParser: StreamParser;
  private currentSessionId: string | null = null;
  private currentTaskId: string | null = null;
  private messages: OpenCodeMessage[] = [];
  private hasCompleted: boolean = false;
  private isDisposed: boolean = false;
  private wasInterrupted: boolean = false;
  private lastWorkingDirectory: string | undefined;
  private options: AdapterOptions;
  public running: boolean = false;

  constructor(options: AdapterOptions, taskId?: string) {
    super();
    this.options = options;
    this.currentTaskId = taskId || null;
    this.streamParser = new StreamParser();
  }

  async startTask(config: TaskConfig): Promise<void> {
    if (this.running) {
      throw new Error('Adapter is already running a task');
    }

    this.currentTaskId = config.taskId;
    this.hasCompleted = false;
    this.wasInterrupted = false;
    this.messages = [];
    this.running = true;

    try {
      const cliCommand = this.options.getCliCommand();
      const cliArgs = await this.options.buildCliArgs(config);
      const env = await this.options.buildEnvironment(config.taskId);

      this.emit('progress', { stage: 'starting', message: 'Starting OpenCode CLI...' });

      const shell = this.options.platform === 'win32' ? 'powershell.exe' : '/bin/bash';
      const shellArgs = this.options.platform === 'win32' 
        ? ['-Command', `${cliCommand.command} ${cliArgs.join(' ')}`]
        : ['-c', `${cliCommand.command} ${cliArgs.join(' ')}`];

      this.ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: config.workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ...env,
          TERM: 'xterm-256color',
        },
      });

      this.ptyProcess.onData((data: string) => {
        this.handlePtyData(data);
      });

      this.ptyProcess.onExit(({ exitCode }) => {
        if (!this.hasCompleted) {
          if (exitCode === 0) {
            this.handleCompletion();
          } else {
            this.emit('error', new Error(`OpenCode CLI exited with code ${exitCode}`));
          }
        }
      });

    } catch (error) {
      this.running = false;
      throw error;
    }
  }

  private handlePtyData(data: string): void {
    const messages = this.streamParser.parseChunk(data);

    for (const message of messages) {
      this.messages.push(message);
      this.emit('message', message);

      switch (message.type) {
        case 'message_start':
          this.currentSessionId = message.session_id || crypto.randomUUID();
          this.emit('progress', { stage: 'running', message: 'Processing...' });
          break;

        case 'content_block_delta':
          if (message.delta?.type === 'thinking') {
            this.emit('reasoning', message.delta.thinking || '');
          } else if (message.delta?.type === 'text_delta') {
            // Text output - handled via message
          }
          break;

        case 'tool_use':
          this.emit('tool-use', message.name || '', message.input || {});
          break;

        case 'tool_result':
          this.emit('tool-call-complete', {
            toolName: '',
            toolInput: {},
            toolOutput: message.content || '',
            sessionId: this.currentSessionId || undefined,
          });
          break;

        case 'message_stop':
          this.handleCompletion();
          break;

        case 'error':
          this.emit('error', new Error(message.error || 'Unknown error'));
          break;
      }
    }
  }

  private handleCompletion(): void {
    if (this.hasCompleted) return;
    this.hasCompleted = true;

    const result: TaskResult = {
      status: this.wasInterrupted ? 'cancelled' : 'success',
      sessionId: this.currentSessionId || undefined,
    };

    this.emit('complete', result);
    this.dispose();
  }

  async sendResponse(response: string): Promise<void> {
    if (!this.ptyProcess) {
      throw new Error('No PTY process running');
    }

    this.ptyProcess.write(response + '\n');
  }

  async cancelTask(): Promise<void> {
    if (this.ptyProcess) {
      this.wasInterrupted = true;
      this.ptyProcess.kill();
    }
    this.dispose();
  }

  async interruptTask(): Promise<void> {
    if (this.ptyProcess) {
      this.ptyProcess.kill('SIGINT');
    }
  }

  getSessionId(): string | null {
    return this.currentSessionId;
  }

  dispose(): void {
    if (this.isDisposed) return;
    this.isDisposed = true;
    this.running = false;

    if (this.ptyProcess) {
      try {
        this.ptyProcess.kill();
      } catch {
        // Process may already be dead
      }
      this.ptyProcess = null;
    }

    this.streamParser.flush();
  }
}

export function createOpenCodeAdapter(options: AdapterOptions, taskId?: string): OpenCodeAdapter {
  return new OpenCodeAdapter(options, taskId);
}
