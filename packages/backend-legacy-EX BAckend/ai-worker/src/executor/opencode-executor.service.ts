/**
 * OpenCode Executor - Ejecutor real de OpenCode CLI
 *
 * Migrated to Bun runtime - uses Bun.spawn instead of node-pty
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { EventEmitter } from 'events';
import { CliResolverService } from './cli-resolver';

export interface ExecutionContext {
  tenantId: string;
  mode: 'FULL' | 'LIMITED';
  workspacePath: string;
  provider?: string;
  model?: string;
}

export interface ExecutionInput {
  prompt: string;
  context?: string;
  tools?: string[];
}

export interface ExecutionOutput {
  response: string;
  sessionId?: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  tools?: {
    name: string;
    input: any;
    output: string;
  }[];
  error?: string;
}

interface ActiveProcess {
  process: ReturnType<typeof Bun.spawn>;
  killed: boolean;
}

export class OpenCodeExecutor extends EventEmitter {
  private cliResolver: CliResolverService;
  private activeProcesses: Map<string, ActiveProcess> = new Map();

  constructor() {
    super();
    this.cliResolver = new CliResolverService();
  }

  async execute(
    context: ExecutionContext,
    input: ExecutionInput,
    options: {
      timeout?: number;
    } = {}
  ): Promise<ExecutionOutput> {
    const sessionId = this.generateSessionId();
    const timeout = options.timeout || 300000;
    const workspacePath = context.workspacePath || this.getDefaultWorkspace(context.tenantId);

    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    try {
      const cli = await this.cliResolver.resolve();

      const args = this.buildArgs(context, input);

      // Determine spawn configuration based on CLI source
      let spawnFile: string;
      let spawnArgs: string[];

      if (cli.source === 'npx') {
        // Use npx to run opencode
        if (process.platform === 'win32') {
          spawnFile = 'npx.cmd';
        } else {
          spawnFile = 'npx';
        }
        spawnArgs = ['opencode', ...args];
      } else {
        // Use direct CLI path
        spawnFile = cli.cliPath;
        spawnArgs = args;
      }

      // Environment variables
      const env: Record<string, string> = {
        ...process.env as Record<string, string>,
        TENANT_ID: context.tenantId,
        EXECUTION_MODE: context.mode,
        OPENCODE_WORKSPACE: workspacePath,
        TERM: 'xterm-256color',
      };

      // Spawn process using Bun
      const process = Bun.spawn({
        cmd: [spawnFile, ...spawnArgs],
        cwd: workspacePath,
        env: env,
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'pipe',
      });

      this.activeProcesses.set(sessionId, { process, killed: false });

      return new Promise((resolve, reject) => {
        let output = '';
        let stderrOutput = '';
        let toolCalls: ExecutionOutput['tools'] = [];
        let isResolved = false;

        const timeoutHandle = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            this.killProcess(sessionId);
            reject(new Error('Execution timeout'));
          }
        }, timeout);

        // Read stdout using reader
        const readStdout = async () => {
          const reader = process.stdout.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const data = decoder.decode(value);
              output += data;
              this.emit('message', data);
            }
          } catch (error) {
            // Reader error - ignore
          }
        };

        // Read stderr using reader
        const readStderr = async () => {
          const reader = process.stderr.getReader();
          const decoder = new TextDecoder();

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const data = decoder.decode(value);
              stderrOutput += data;
            }
          } catch (error) {
            // Reader error - ignore
          }
        };

        // Wait for process completion
        const waitForExit = async () => {
          try {
            const exitCode = await process.exited;

            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeoutHandle);
            this.activeProcesses.delete(sessionId);

            if (exitCode === 0) {
              const result: ExecutionOutput = {
                response: this.extractResponse(output),
                sessionId,
                tools: toolCalls,
              };
              this.emit('complete', result);
              resolve(result);
            } else {
              const error = new Error(`OpenCode exited with code ${exitCode}: ${stderrOutput || output}`);
              this.emit('error', error);
              reject(error);
            }
          } catch (error) {
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutHandle);
              this.activeProcesses.delete(sessionId);
              reject(error);
            }
          }
        };

        // Start reading streams and wait for completion
        Promise.all([readStdout(), readStderr()]).then(() => {
          return waitForExit();
        }).catch((error) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutHandle);
            this.activeProcesses.delete(sessionId);
            reject(error);
          }
        });
      });
    } catch (error) {
      return {
        response: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async cancelExecution(sessionId: string): Promise<void> {
    this.killProcess(sessionId);
  }

  cancelAll(): void {
    for (const [sessionId] of this.activeProcesses) {
      this.killProcess(sessionId);
    }
    this.activeProcesses.clear();
  }

  private killProcess(sessionId: string): void {
    const activeProcess = this.activeProcesses.get(sessionId);
    if (activeProcess && !activeProcess.killed) {
      try {
        activeProcess.process.kill();
        activeProcess.killed = true;
      } catch (error) {
        // Ignore kill errors
      }
      this.activeProcesses.delete(sessionId);
    }
  }

  private buildArgs(context: ExecutionContext, input: ExecutionInput): string[] {
    const args: string[] = ['--no-interactive'];

    args.push('--prompt', input.prompt);

    if (context.provider) {
      args.push('--provider', context.provider);
    }

    if (context.model) {
      args.push('--model', context.model);
    }

    if (context.mode === 'LIMITED') {
      args.push('--limited');
    }

    if (input.tools && input.tools.length > 0) {
      args.push('--tools', input.tools.join(','));
    }

    return args;
  }

  private extractResponse(output: string): string {
    const lines = output.split('\n');
    const responseLines: string[] = [];
    let inResponse = false;

    for (const line of lines) {
      if (line.includes('=== Response ===') || line.includes('Output:')) {
        inResponse = true;
        continue;
      }
      if (line.includes('=== End ===')) {
        break;
      }
      if (inResponse && line.trim()) {
        responseLines.push(line);
      }
    }

    return responseLines.join('\n').trim() || output;
  }

  private getDefaultWorkspace(tenantId: string): string {
    return path.join(os.homedir(), '.agento', 'workspaces', tenantId);
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const openCodeExecutor = new OpenCodeExecutor();
