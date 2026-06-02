/**
 * FullModeAdapter - Adaptador para ejecución en modo FULL de Accomplish
 *
 * Ejecuta OpenCode CLI con TODAS las herramientas disponibles (bash, write, edit, etc.)
 * Similar a Accomplish original, integrado con la infraestructura multi-tenant.
 *
 * Herramientas disponibles en modo FULL:
 * - bash, write, edit, read, glob, grep, list
 * - webfetch, websearch
 * - execute_code (Python, JavaScript)
 * - excel_read, excel_write
 * - sheets_read, sheets_write
 * - knowledge_query (RAG)
 */

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TenantManager, TenantConfig } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';
import { SecurityLayerService, ExecutionMode, securityLayer, FULL_MODE_ALLOWED_TOOLS } from '../security';

// ============================================
// Interfaces
// ============================================

export interface ExecutionContext {
  tenantId: string;
  taskId: string;
  workspacePath: string;
  sessionId?: string;
  conversationHistory?: ConversationMessage[];
  metadata?: Record<string, any>;
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp?: string;
  toolName?: string;
  toolInput?: any;
  toolOutput?: any;
}

export interface ExecutionResult {
  success: boolean;
  content: string;
  sessionId?: string;
  tokensUsed?: number;
  executionTime: number;
  toolsUsed?: ToolExecution[];
  messages: ConversationMessage[];
  error?: string;
}

export interface ToolExecution {
  toolName: string;
  input: any;
  output?: any;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  timestamp: Date;
}

export interface FullModeAdapterEvents {
  'message': [ConversationMessage];
  'tool-start': [string, any];
  'tool-complete': [string, any, any];
  'tool-error': [string, any, Error];
  'progress': [{ step: string; progress: number; details?: string }];
  'permission-request': [PermissionRequestData];
  'complete': [ExecutionResult];
  'error': [Error];
}

export interface PermissionRequestData {
  requestId: string;
  taskId: string;
  type: 'tool' | 'question' | 'custom';
  toolName?: string;
  description: string;
  options?: string[];
  timeout: number;
}

// ============================================
// FullModeAdapter
// ============================================

export class FullModeAdapter extends EventEmitter<FullModeAdapterEvents> {
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private securityLayer: SecurityLayerService;
  private bunProcesses: Map<string, Bun.Subprocess> = new Map();
  private readonly DEFAULT_TIMEOUT = 600000; // 10 minutos para modo FULL
  private readonly MAX_TIMEOUT = 900000; // 15 minutos máximo

  // Handlers de permisos por taskId
  private permissionHandlers: Map<string, (response: any) => void> = new Map();

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager,
    securityLayerService?: SecurityLayerService
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();
    this.securityLayer = securityLayerService || securityLayer;
  }

  /**
   * Ejecuta una tarea en modo FULL
   */
  async execute(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const toolsUsed: ToolExecution[] = [];

    try {
      // 1. Validar contexto
      if (!context.tenantId || !context.taskId) {
        throw new Error('tenantId y taskId son requeridos');
      }

      // 2. Obtener configuración del tenant
      const config = await this.tenantManager.getConfig(context.tenantId);
      if (!config) {
        throw new Error(`Tenant ${context.tenantId} not configured`);
      }

      // 3. Asegurar workspace
      const workspacePath = context.workspacePath ||
        this.workspaceManager.ensureWorkspace(context.tenantId);

      // 4. Generar configuración de OpenCode
      const openCodeConfigPath = await this.generateFullModeConfig(
        context.tenantId,
        workspacePath,
        config,
        context
      );

      // 5. Construir prompt completo con historial
      const fullPrompt = this.buildPrompt(prompt, context, config);

      // 6. Ejecutar OpenCode
      const result = await this.executeOpenCode(
        context.taskId,
        fullPrompt,
        workspacePath,
        openCodeConfigPath,
        config,
        {
          onMessage: (msg) => {
            messages.push(msg);
            this.emit('message', msg);
          },
          onToolStart: (tool, input) => {
            this.emit('tool-start', tool, input);
          },
          onToolComplete: (tool, input, output) => {
            const execution: ToolExecution = {
              toolName: tool,
              input,
              output,
              status: 'completed',
              timestamp: new Date(),
            };
            toolsUsed.push(execution);
            this.emit('tool-complete', tool, input, output);
          },
          onToolError: (tool, input, error) => {
            const execution: ToolExecution = {
              toolName: tool,
              input,
              status: 'failed',
              timestamp: new Date(),
            };
            toolsUsed.push(execution);
            this.emit('tool-error', tool, input, error);
          },
          onProgress: (step, progress, details) => {
            this.emit('progress', { step, progress, details });
          },
          onPermissionRequest: (request) => {
            this.emit('permission-request', request);
          },
        }
      );

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        content: result.content,
        sessionId: result.sessionId,
        tokensUsed: result.tokensUsed,
        executionTime,
        toolsUsed,
        messages,
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      this.emit('error', error instanceof Error ? error : new Error(errorMessage));

      return {
        success: false,
        content: '',
        executionTime,
        toolsUsed,
        messages,
        error: errorMessage,
      };
    }
  }

  /**
   * Ejecuta OpenCode CLI en modo FULL
   */
  private async executeOpenCode(
    taskId: string,
    prompt: string,
    workspacePath: string,
    configPath: string,
    config: TenantConfig,
    handlers: {
      onMessage: (msg: ConversationMessage) => void;
      onToolStart: (tool: string, input: any) => void;
      onToolComplete: (tool: string, input: any, output: any) => void;
      onToolError: (tool: string, input: any, error: Error) => void;
      onProgress: (step: string, progress: number, details?: string) => void;
      onPermissionRequest: (request: PermissionRequestData) => void;
    }
  ): Promise<{ content: string; sessionId?: string; tokensUsed?: number }> {
    return new Promise((resolve, reject) => {
      let output = '';
      let sessionId: string | undefined;
      let tokensUsed = 0;
      let isResolved = false;

      const timeout = Math.min(this.DEFAULT_TIMEOUT, this.MAX_TIMEOUT);
      const isWindows = process.platform === 'win32';

      // Construir argumentos para modo FULL
      // NOTA: Usar modelo por defecto de OpenCode ya que los proveedores personalizados
      // necesitan configuración especial en el archivo config.json del proyecto
      const args = [
        'run',
        '--format', 'json',
        // '--model', `${config.provider}/${config.model}`, // Comentado - usar modelo por defecto
        // '--agent', 'agento-agent', // Comentado - usar agente por defecto
        '--max-iterations', '50',
        '--timeout', `${timeout}ms`,
        prompt
      ];

      // Variables de entorno
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        OPENCODE_CONFIG: configPath,
        TASK_ID: taskId,
        EXECUTION_MODE: 'FULL',
        // Permitir todas las herramientas en modo FULL
        ALLOWED_TOOLS: FULL_MODE_ALLOWED_TOOLS.join(','),
      };

      console.log(`[FullModeAdapter] Executing OpenCode for task ${taskId}`);
      console.log(`[FullModeAdapter] Mode: FULL`);
      console.log(`[FullModeAdapter] Workspace: ${workspacePath}`);

      // Configurar shell según SO
      // Basado en OpenCodeAdapter original: en Windows ejecutar directamente el .exe
      // NO usar cmd.exe wrapper
      let spawnFile: string;
      let spawnArgs: string[];
      let projectRoot = process.cwd(); // Declarar fuera del bloque if

      if (isWindows) {
        // En Windows, usar el path completo a opencode.exe DENTRO del proyecto
        // El proyecto usa workspace con node_modules en la raíz
        // Determinar la raíz del proyecto (agenTo-saas-nodejs)
        // Si estamos en packages/server o packages/agent-core, subir a la raíz
        if (projectRoot.includes('packages\\server') || projectRoot.includes('packages/server')) {
          projectRoot = path.join(process.cwd(), '..', '..');
        } else if (projectRoot.includes('packages\\agent-core') || projectRoot.includes('packages/agent-core')) {
          projectRoot = path.join(process.cwd(), '..', '..');
        }

        const possiblePaths = [
          path.join(projectRoot, 'node_modules', 'opencode-windows-x64-baseline', 'bin', 'opencode.exe'),
          path.join(projectRoot, 'node_modules', 'opencode-windows-x64', 'bin', 'opencode.exe'),
        ];

        spawnFile = possiblePaths.find(p => fs.existsSync(p)) || 'opencode.exe';
        spawnArgs = args;

        console.log(`[FullModeAdapter] Project root: ${projectRoot}`);
        console.log(`[FullModeAdapter] OpenCode path: ${spawnFile}`);
        console.log(`[FullModeAdapter] OpenCode exists: ${fs.existsSync(spawnFile)}`);
      } else {
        // En Unix, usar bash
        spawnFile = '/bin/bash';
        const escapedArgs = args.map(a => this.escapeArg(a, false));
        const fullCommand = `npx opencode ${escapedArgs.join(' ')}`;
        spawnArgs = ['-c', fullCommand];
      }

      console.log(`[FullModeAdapter] Spawn: ${spawnFile} ${spawnArgs.slice(0, 3).join(' ')}...`);
      console.log(`[FullModeAdapter] Working directory: ${workspacePath}`);

      // Determinar el directorio de trabajo correcto
      // Usar el projectRoot calculado anteriormente (que es la raíz del proyecto)
      let workingDir = workspacePath;
      if (isWindows) {
        // En Windows, usar el directorio raíz del proyecto para que OpenCode funcione correctamente
        workingDir = projectRoot;
      }

      console.log(`[FullModeAdapter] Using working dir: ${workingDir}`);

      // Spawn using Bun.spawn
      const proc = Bun.spawn({
        cmd: [spawnFile, ...spawnArgs],
        cwd: workingDir,
        env: env as Record<string, string>,
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'pipe',
      });

      this.bunProcesses.set(taskId, proc);

      // Timeout handler
      const timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.cleanup(taskId);
          reject(new Error(`Timeout after ${timeout}ms`));
        }
      }, timeout);

      // Read stdout using reader pattern
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();

      // Read loop - process output as it comes
      const readOutput = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const data = decoder.decode(value);
            output += data;

            this.parseOutput(data, taskId, {
              onSessionId: (id) => { sessionId = id; },
              onTokens: (tokens) => { tokensUsed = tokens; },
              onMessage: (msg) => { handlers.onMessage(msg); },
              onToolStart: (tool, input) => {
                // Validar tool con SecurityLayer (modo FULL permite todo)
                const validation = this.securityLayer.validateTool(tool, ExecutionMode.FULL);

                if (!validation.allowed) {
                  console.log(`[FullModeAdapter] Tool '${tool}' bloqueada: ${validation.reason}`);
                  handlers.onToolError(tool, input, new Error(validation.reason));
                  return;
                }

                handlers.onToolStart(tool, input);
              },
              onToolComplete: (tool, input, output) => {
                handlers.onToolComplete(tool, input, output);
              },
              onToolError: (tool, input, error) => {
                handlers.onToolError(tool, input, error);
              },
              onProgress: (step, progress, details) => {
                handlers.onProgress(step, progress, details);
              }
            });
          }
        } catch (readError) {
          console.error(`[FullModeAdapter] Error reading stdout:`, readError);
        }
      };

      // Also read stderr
      const stderrReader = proc.stderr.getReader();
      const readStderr = async () => {
        try {
          while (true) {
            const { done, value } = await stderrReader.read();
            if (done) break;
            const errorData = decoder.decode(value);
            console.error(`[FullModeAdapter] stderr:`, errorData);
            output += errorData;
          }
        } catch (errReadError) {
          console.error(`[FullModeAdapter] Error reading stderr:`, errReadError);
        }
      };

      // Wait for process to exit
      const waitForExit = async () => {
        const exitCode = await proc.exited;

        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutHandle);
        this.bunProcesses.delete(taskId);

        const content = this.extractResponse(output);

        if (exitCode === 0) {
          resolve({ content, sessionId, tokensUsed });
        } else {
          resolve({
            content: content || this.extractFallbackResponse(output),
            sessionId,
            tokensUsed
          });
        }
      };

      // Run all async operations
      Promise.all([readOutput(), readStderr(), waitForExit()]).catch(reject);
    });
  }

  /**
   * Genera configuración de OpenCode para modo FULL
   */
  private async generateFullModeConfig(
    tenantId: string,
    workspacePath: string,
    config: TenantConfig,
    context: ExecutionContext
  ): Promise<string> {
    // Obtener API key del contexto (viene de SecureStorage)
    const apiKey = context.metadata?.apiKeys?.[config.provider];

    if (!apiKey) {
      throw new Error(`No API key found for provider: ${config.provider}. Please configure it through the admin panel.`);
    }

    // Determinar API URL según el provider
    let apiUrl = 'https://api.openai.com'; // Default
    if (config.provider === 'deepseek') {
      apiUrl = 'https://api.deepseek.com';
    } else if (config.provider === 'kimi-coding') {
      apiUrl = 'https://api.moonshot.cn/v1';
    } else if (config.provider === 'opencode') {
      apiUrl = 'https://api.opencode.ai/v1';
    }

    const openCodeConfig = {
      // Configuración del modelo
      model: `${config.provider}/${config.model}`,
      apiKey,
      apiUrl,

      // Configuración del agente
      agent: {
        name: 'agento-agent',
        description: 'Agente de IA multi-propósito para AgenTo SaaS',
        instructions: config.knowledgeBase?.instructions || 'Eres un asistente de IA útil y capaz.',
      },

      // Configuración de herramientas - MODO FULL
      tools: {
        // Herramientas de sistema de archivos
        bash: { enabled: true, timeout: 30000 },
        write: { enabled: true },
        edit: { enabled: true },
        read: { enabled: true },
        glob: { enabled: true },
        grep: { enabled: true },
        list: { enabled: true },

        // Herramientas web
        webfetch: { enabled: true, timeout: 30000 },
        websearch: { enabled: true, timeout: 30000 },

        // Herramientas de código
        execute_code: {
          enabled: true,
          languages: ['python', 'javascript', 'typescript'],
          timeout: 60000,
        },

        // Herramientas de Excel/Sheets
        excel_read: { enabled: true },
        excel_write: { enabled: true },
        sheets_read: { enabled: true },
        sheets_write: { enabled: true },

        // Herramientas de conocimiento
        knowledge_query: { enabled: true },
      },

      // Configuración de seguridad
      security: {
        maxIterations: 50,
        maxTokens: 100000,
        timeout: 600000,
        allowedPaths: [workspacePath],
      },

      // Configuración de salida
      output: {
        format: 'json',
        streaming: true,
      },
    };

    // Guardar configuración en archivo temporal
    const configDir = path.join(workspacePath, '.opencode');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }

    const configPath = path.join(configDir, `full-mode-${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(openCodeConfig, null, 2));

    return configPath;
  }

  /**
   * Construye el prompt completo
   */
  private buildPrompt(
    prompt: string,
    context: ExecutionContext,
    config: TenantConfig
  ): string {
    const parts: string[] = [];

    // Instrucciones del sistema
    parts.push('=== MODO FULL DE ACCOMPLISH ===');
    parts.push('Tienes acceso completo a todas las herramientas disponibles.');
    parts.push('Puedes ejecutar bash, editar archivos, buscar código, y más.');
    parts.push('');

    // Historial de conversación
    if (context.conversationHistory && context.conversationHistory.length > 0) {
      parts.push('=== HISTORIAL DE CONVERSACIÓN ===');
      context.conversationHistory.slice(-50).forEach(msg => {
        const roleLabel = {
          user: 'Usuario',
          assistant: 'Asistente',
          system: 'Sistema',
          tool: 'Herramienta',
        }[msg.role];

        parts.push(`${roleLabel}: ${msg.content}`);
      });
      parts.push('');
    }

    // Prompt actual
    parts.push('=== TAREA ===');
    parts.push(prompt);

    return parts.join('\n');
  }

  /**
   * Parsea la salida de OpenCode
   */
  private parseOutput(
    data: string,
    taskId: string,
    handlers: {
      onSessionId: (id: string) => void;
      onTokens: (tokens: number) => void;
      onMessage: (msg: ConversationMessage) => void;
      onToolStart: (tool: string, input: any) => void;
      onToolComplete: (tool: string, input: any, output: any) => void;
      onToolError: (tool: string, input: any, error: Error) => void;
      onProgress: (step: string, progress: number, details?: string) => void;
    }
  ): void {
    const lines = data.split('\n');

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('{')) continue;

      try {
        const parsed = JSON.parse(line);

        // Session ID
        if (parsed.sessionID) {
          handlers.onSessionId(parsed.sessionID);
        }

        // Mensajes
        if (parsed.type === 'text' && parsed.part?.text) {
          handlers.onMessage({
            role: 'assistant',
            content: parsed.part.text,
            timestamp: new Date().toISOString(),
          });
        }

        // Progreso
        if (parsed.type === 'step_start') {
          handlers.onProgress('connecting', 0, 'Conectando con el agente...');
        }

        if (parsed.type === 'step_progress') {
          const progress = parsed.part?.progress || 0;
          handlers.onProgress('working', progress, parsed.part?.message);
        }

        // Herramientas
        if (parsed.type === 'tool_use') {
          const toolName = parsed.part?.tool;
          const toolInput = parsed.part?.input;

          if (toolName) {
            handlers.onToolStart(toolName, toolInput);
          }
        }

        if (parsed.type === 'tool_result') {
          const toolName = parsed.part?.tool;
          const toolOutput = parsed.part?.output;

          if (toolName) {
            if (parsed.part?.error) {
              handlers.onToolError(toolName, parsed.part.input, new Error(parsed.part.error));
            } else {
              handlers.onToolComplete(toolName, parsed.part.input, toolOutput);
            }
          }
        }

        // Tokens
        if (parsed.type === 'step_finish') {
          if (parsed.part?.tokens) {
            const totalTokens = (parsed.part.tokens.input || 0) + (parsed.part.tokens.output || 0);
            handlers.onTokens(totalTokens);
          }
          handlers.onProgress('complete', 100, 'Tarea completada');
        }

      } catch (e) {
        // Ignorar errores de parseo
      }
    }
  }

  /**
   * Extrae la respuesta de la salida
   */
  private extractResponse(output: string): string {
    // Remover códigos ANSI
    let cleaned = output.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
    cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, '');

    // Buscar líneas JSON con texto
    const lines = cleaned.split('\n');
    const textParts: string[] = [];

    for (const line of lines) {
      if (line.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.type === 'text' && parsed.part?.text) {
            textParts.push(parsed.part.text);
          }
        } catch (e) {
          // Ignore
        }
      }
    }

    if (textParts.length > 0) {
      return textParts.join('\n');
    }

    // Fallback: buscar texto después de marcadores
    const textMatch = cleaned.match(/(?:Response|Answer|Output|Final):\s*([\s\S]*?)(?=(?:===|$))/i);
    if (textMatch && textMatch[1]) {
      return textMatch[1].trim();
    }

    return cleaned.trim();
  }

  /**
   * Extrae respuesta de fallback
   */
  private extractFallbackResponse(output: string): string {
    let cleaned = output
      .replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '')
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/g, '')
      .trim();

    if (cleaned.length > 1000) {
      cleaned = cleaned.substring(0, 1000) + '...';
    }

    return cleaned;
  }

  /**
   * Escapa argumentos para shell
   */
  private escapeArg(arg: string, isWindows: boolean): string {
    if (isWindows) {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
        return `"${arg.replace(/"/g, '""')}"`;
      }
      return arg;
    } else {
      if (arg.includes(' ') || arg.includes('"') || arg.includes("'") || arg.includes('$')) {
        return `'${arg.replace(/'/g, "'\\''")}'`;
      }
      return arg;
    }
  }

  /**
   * Limpia procesos Bun.spawn
   */
  private cleanup(taskId: string): void {
    const proc = this.bunProcesses.get(taskId);
    if (proc) {
      try {
        proc.kill();
      } catch (e) {
        // Ignore
      }
      this.bunProcesses.delete(taskId);
    }
  }

  /**
   * Cancela la ejecución actual
   */
  cancel(taskId: string): void {
    this.cleanup(taskId);
  }

  /**
   * Responde a una solicitud de permiso
   */
  respondToPermission(taskId: string, response: any): void {
    const handler = this.permissionHandlers.get(taskId);
    if (handler) {
      handler(response);
      this.permissionHandlers.delete(taskId);
    }
  }

  /**
   * Verifica disponibilidad de OpenCode
   */
  async checkAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const { execSync } = require('child_process');
      const output = execSync('npx opencode --version', {
        encoding: 'utf-8',
        timeout: 30000
      });
      const versionMatch = output.match(/(\d+\.\d+\.\d+)/);
      return {
        available: true,
        version: versionMatch ? versionMatch[1] : 'unknown'
      };
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const fullModeAdapter = new FullModeAdapter();
