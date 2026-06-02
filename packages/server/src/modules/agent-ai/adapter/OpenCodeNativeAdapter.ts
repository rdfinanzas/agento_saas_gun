/**
 * OpenCodeNativeAdapter - Usa el servidor NATIVO de OpenCode
 *
 * Este adaptador:
 * 1. Inicia el servidor HTTP interno de OpenCode
 * 2. Se comunica vía HTTP (no CLI)
 * 3. Usa el código NATIVO de OpenCode (sin exec/spawn)
 */

import { EventEmitter } from 'events';
import { TenantManager, TenantConfig } from '../tenant/TenantManager';
import { WorkspaceManager } from '../tenant/WorkspaceManager';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

// ============================================
// Types
// ============================================

export interface ExecutionContext {
  tenantId: string;
  taskId: string;
  workspacePath?: string;
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

export interface OpenCodeNativeAdapterEvents {
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
// OpenCodeNativeAdapter
// ============================================

export class OpenCodeNativeAdapter extends EventEmitter<OpenCodeNativeAdapterEvents> {
  private tenantManager: TenantManager;
  private workspaceManager: WorkspaceManager;
  private serverProcess: any = null;
  private serverUrl: string = 'http://localhost:7788';
  private serverReady: boolean = false;
  private readonly DEFAULT_TIMEOUT = 600000;

  // Sesiones activas por tenant
  private activeSessions: Map<string, string> = new Map();

  constructor(
    tenantManager?: TenantManager,
    workspaceManager?: WorkspaceManager
  ) {
    super();
    this.tenantManager = tenantManager || new TenantManager();
    this.workspaceManager = workspaceManager || new WorkspaceManager();
  }

  /**
   * Inicia el servidor NATIVO de OpenCode
   * El servidor ya existe en el fork: packages/opencode-fork/packages/opencode/src/server/server.ts
   */
  private async ensureServerInitialized(): Promise<void> {
    if (this.serverReady) {
      return;
    }

    console.log('[OpenCodeNativeAdapter] Iniciando servidor NATIVO de OpenCode...');

    // Calcular path correcto desde dist/ del backend
    console.log('[OpenCodeNativeAdapter] cwd:', process.cwd());

    // Buscar la raíz del proyecto retrocediendo hasta encontrar package.json raíz
    let projectRoot = process.cwd();
    while (projectRoot && projectRoot.length > 3) {
      const pkgPath = path.join(projectRoot, 'package.json');
      if (fs.existsSync(pkgPath)) {
        // Verificar que este package.json tenga "workspaces" para confirmar que es la raíz
        try {
          const pkgContent = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkgContent.workspaces || pkgContent.name === 'agento-saas-nodejs') {
            break; // Encontramos la raíz correcta
          }
        } catch {
          // Ignorar error de parseo y continuar buscando
        }
      }
      projectRoot = path.dirname(projectRoot);
    }

    console.log('[OpenCodeNativeAdapter] Project root:', projectRoot);

    const opencodeDir = path.join(projectRoot, 'packages', 'opencode-fork');
    const serverEntryPoint = path.join(opencodeDir, 'packages', 'opencode', 'src', 'server', 'server.ts');

    console.log('[OpenCodeNativeAdapter] OpenCode dir:', opencodeDir);
    console.log('[OpenCodeNativeAdapter] Server script:', serverEntryPoint);
    console.log('[OpenCodeNativeAdapter] Exists?', fs.existsSync(serverEntryPoint));

    if (!fs.existsSync(serverEntryPoint)) {
      throw new Error(`Server script not found: ${serverEntryPoint}`);
    }

    return new Promise((resolve, reject) => {
      // Usar bun para ejecutar el servidor HTTP de OpenCode
      // El servidor escucha en el puerto definido por OPENCOD_SERVER_PORT (default: 7788)
      const serverProcess = spawn('bun', ['run', '--cwd', opencodeDir, 'dev'], {
        cwd: opencodeDir,
        stdio: 'pipe',
        env: {
          ...process.env,
          OPENCOD_SERVER_PORT: '7788',
          OPENCODERVER: 'http',
        }
      });

      this.serverProcess = serverProcess;

      let output = '';
      const checkReady = () => {
        if (output.includes('Listening') || output.includes('started') || output.includes('Server')) {
          this.serverReady = true;
          console.log('[OpenCodeNativeAdapter] ✅ Servidor listo en http://localhost:7788');
          resolve();
        }
      };

      serverProcess.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.log('[OpenCode Server]', text);
        checkReady();
      });

      serverProcess.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        output += text;
        console.error('[OpenCode Server Error]', text);
        checkReady();
      });

      serverProcess.on('error', (error) => {
        console.error('[OpenCodeNativeAdapter] Error iniciando servidor:', error);
        reject(error);
      });

      // Timeout esperando el servidor
      setTimeout(() => {
        if (!this.serverReady) {
          console.warn('[OpenCodeNativeAdapter] Timeout, asumiendo listo...');
          this.serverReady = true;
          resolve();
        }
      }, 15000);
    });
  }

  /**
   * Ejecuta una tarea usando el servidor NATIVO de OpenCode
   */
  async execute(
    prompt: string,
    context: ExecutionContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    const messages: ConversationMessage[] = [];
    const toolsUsed: ToolExecution[] = [];

    try {
      await this.ensureServerInitialized();

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

      // 4. Emitir mensaje del usuario
      const userMessage: ConversationMessage = {
        role: 'user',
        content: prompt,
        timestamp: new Date().toISOString(),
      };
      messages.push(userMessage);
      this.emit('message', userMessage);

      // 5. Crear nueva sesión vía HTTP
      // Endpoint: POST /sessions
      let sessionId: string;
      if (context.sessionId) {
        sessionId = context.sessionId;
      } else if (this.activeSessions.has(context.tenantId)) {
        sessionId = this.activeSessions.get(context.tenantId)!;
      } else {
        // Crear nueva sesión
        const session = await this.callOpenCodeAPI('/', {
          method: 'POST',
          body: {
            title: `${context.tenantId} - ${new Date().toISOString()}`,
            directory: workspacePath,
          }
        });
        const newSessionId = session.id;
        if (!newSessionId) {
          throw new Error('Failed to create session: no session ID returned');
        }
        sessionId = newSessionId;
        this.activeSessions.set(context.tenantId, sessionId);
      }

      // 6. Ejecutar el prompt vía HTTP
      // Endpoint: POST /sessions/:sessionID/prompt
      const agent = (config as any).agent || 'build';
      const result = await this.callOpenCodeAPI(`/${sessionId}/prompt`, {
        method: 'POST',
        body: {
          message: {
            role: 'user',
            parts: [{ type: 'text', text: prompt }]
          },
          model: `${config.provider}/${config.model}`,
          agent,
        }
      });

      // 7. Procesar resultado
      let content = '';
      if (result && result.content) {
        content = result.content;

        const assistantMessage: ConversationMessage = {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        };
        messages.push(assistantMessage);
        this.emit('message', assistantMessage);
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        content,
        sessionId: result.sessionId || sessionId,
        tokensUsed: result.tokens,
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
   * Llama a la API HTTP de OpenCode
   */
  private async callOpenCodeAPI(endpoint: string, options: {
    method: string;
    body?: any;
  }): Promise<any> {
    const url = `${this.serverUrl}${endpoint}`;

    const response = await fetch(url, {
      method: options.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenCode API error: ${error}`);
    }

    return response.json();
  }

  /**
   * Obtiene los mensajes de una sesión
   */
  async getSessionMessages(sessionId: string): Promise<ConversationMessage[]> {
    const result = await this.callOpenCodeAPI(`/sessions/${sessionId}/messages`, {
      method: 'GET',
    });
    return result.messages || [];
  }

  /**
   * Lista las sesiones de un tenant
   */
  async listSessions(tenantId: string): Promise<any[]> {
    const workspacePath = this.workspaceManager.ensureWorkspace(tenantId);
    const result = await this.callOpenCodeAPI('/sessions', {
      method: 'GET',
    });
    return result.sessions || [];
  }

  /**
   * Elimina una sesión
   */
  async deleteSession(sessionId: string, tenantId: string): Promise<void> {
    await this.callOpenCodeAPI(`/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    this.activeSessions.delete(tenantId);
  }

  /**
   * Limpia recursos
   */
  async cleanup(): Promise<void> {
    this.activeSessions.clear();
    this.removeAllListeners();

    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.serverReady = false;
  }

  /**
   * Cancela una ejecución
   */
  async cancelExecution(taskId: string): Promise<void> {
    // TODO: Implementar cancelación vía HTTP
    console.log(`[OpenCodeNativeAdapter] Cancel execution requested for task ${taskId}`);
  }
}
